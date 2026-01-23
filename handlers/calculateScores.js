const db = require('../db');
const logger = require('../utils/logger');
const { safeQuery } = require('../utils/safeQuery');
const { computeTotalPoints } = require('../utils/matchScoring'); // ✅

const cleanList = (val) => {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  return String(val)
    .replace(/[\[\]"]+/g, '')
    .split(/[;,]+/)
    .map(t => t.trim())
    .filter(Boolean);
};

module.exports = async function calculateScores(guildId) {
  if (!guildId) {
    logger.error('scores', 'calculateScores called without guild context', {
      scope: 'cron:calculateScores',
    });
    throw new Error('calculateScores called without guild context');
  }

  const pool = db.getPoolForGuild(guildId);

  logger.info('scores', 'Score calculation started', {
    guildId,
    scope: 'cron:calculateScores',
  });

  // ⬇️ CAŁA RESZTA KODU (SWISS / PLAYOFFS / ...)



  /* =========================
     SWISS
     ========================= */
  try {
    const [swissResultsRows] = await safeQuery(
      pool,
      `SELECT *
FROM swiss_results
WHERE guild_id = ?
  AND active = 1
ORDER BY id DESC
LIMIT 1
`,
      [guildId],
      { guildId, scope: 'cron:calculateScores', label: 'select swiss_results' }
    );

    if (!swissResultsRows.length) {
      logger.warn('scores', 'No active Swiss results', {
        guildId,
        scope: 'cron:calculateScores',
      });
    }

    for (const correctSwiss of swissResultsRows) {
      const stageRaw = correctSwiss.stage; // ✅ u Ciebie enum: stage1/stage2/stage3
      const stage = stageRaw;             // ✅ NIE robimy "1/2/3" (bo enum tego nie przyjmie)

      logger.info('scores', 'Calculating Swiss stage', {
        guildId,
        stage,
        scope: 'cron:calculateScores',
      });

      const correct30 = cleanList(correctSwiss.correct_3_0);
      const correct03 = cleanList(correctSwiss.correct_0_3);
      const correctAdv = cleanList(correctSwiss.correct_advancing);

      const [swissPredictions] = await safeQuery(
        pool,
        `SELECT * FROM swiss_predictions WHERE guild_id = ? AND stage = ?`,
        [guildId, stageRaw],
        { guildId, scope: 'cron:calculateScores', label: 'select swiss_predictions' }
      );

      const [nameRows] = await safeQuery(
        pool,
        `
        SELECT user_id, displayname
        FROM swiss_predictions
        WHERE guild_id = ?
          AND stage = ?
          AND displayname IS NOT NULL
          AND displayname != ''
        `,
        [guildId, stageRaw],
        { guildId, scope: 'cron:calculateScores', label: 'preload swiss displaynames' }
      );

      const displayNameMap = new Map(
        nameRows.map(r => [r.user_id, r.displayname])
      );

      const swissScoreRows = [];

      for (const pred of swissPredictions) {
        const user_id = pred.user_id;
        const displayname =
          pred.displayname ||
          displayNameMap.get(user_id) ||
          user_id;

        let score = 0;
        cleanList(pred.pick_3_0).forEach(t => {
          if (correct30.includes(t)) score += 4;
        });
        cleanList(pred.pick_0_3).forEach(t => {
          if (correct03.includes(t)) score += 4;
        });
        cleanList(pred.advancing).forEach(t => {
          if (correctAdv.includes(t)) score += 2;
        });

        swissScoreRows.push([
          guildId,
          user_id,
          stage, // ✅ stage1/stage2/stage3
          displayname,
          score,
        ]);
      }

      if (swissScoreRows.length) {
        await safeQuery(
          pool,
          `
          INSERT INTO swiss_scores (guild_id, user_id, stage, displayname, points)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            displayname = VALUES(displayname),
            points = VALUES(points)
          `,
          [swissScoreRows],
          { guildId, scope: 'cron:calculateScores', label: 'batch upsert swiss_scores' }
        );
      }

      logger.info('scores', 'Swiss stage calculated', {
        guildId,
        stage,
        users: swissScoreRows.length,
        scope: 'cron:calculateScores',
      });
    }
  } catch (err) {
    logger.error('scores', 'Swiss calculation failed', {
      guildId,
      scope: 'cron:calculateScores',
      message: err.message,
      stack: err.stack,
    });
  }

  /* =========================
     PLAYOFFS
     ========================= */
  try {
    const [playoffsResultsRows] = await safeQuery(
      pool,
      `SELECT * FROM playoffs_results WHERE guild_id = ? AND active = 1 ORDER BY id DESC LIMIT 1`,
      [guildId],
      { guildId, scope: 'cron:calculateScores', label: 'select playoffs_results' }
    );

    if (!playoffsResultsRows.length) {
      logger.warn('scores', 'No active Playoffs results', {
        guildId,
        scope: 'cron:calculateScores',
      });
    } else {
      logger.info('scores', 'Calculating Playoffs', {
        guildId,
        scope: 'cron:calculateScores',
      });

      const correctPlayoffs = playoffsResultsRows[0];

      const [playoffsPredictions] = await safeQuery(
        pool,
        `SELECT * FROM playoffs_predictions WHERE guild_id = ? AND active = 1`,
        [guildId],
        { guildId, scope: 'cron:calculateScores', label: 'select playoffs_predictions' }
      );

      const [nameRows] = await safeQuery(
        pool,
        `
        SELECT user_id, displayname
        FROM playoffs_predictions
        WHERE guild_id = ?
          AND displayname IS NOT NULL
          AND displayname != ''
        `,
        [guildId],
        { guildId, scope: 'cron:calculateScores', label: 'preload playoffs displaynames' }
      );

      const displayNameMap = new Map(
        nameRows.map(r => [r.user_id, r.displayname])
      );

      const playoffsScoreRows = [];

      for (const pred of playoffsPredictions) {
        const user_id = pred.user_id;
        const displayname =
          pred.displayname ||
          displayNameMap.get(user_id) ||
          user_id;

        let score = 0;
        cleanList(pred.semifinalists).forEach(t => {
          if (cleanList(correctPlayoffs.correct_semifinalists).includes(t)) score += 1;
        });
        cleanList(pred.finalists).forEach(t => {
          if (cleanList(correctPlayoffs.correct_finalists).includes(t)) score += 2;
        });
        if (pred.winner === correctPlayoffs.correct_winner) score += 3;
        if (pred.third_place_winner === correctPlayoffs.correct_third_place_winner) score += 2;

        playoffsScoreRows.push([
          guildId,
          user_id,
          displayname,
          score,
        ]);
      }

      if (playoffsScoreRows.length) {
        await safeQuery(
          pool,
          `
          INSERT INTO playoffs_scores (guild_id, user_id, displayname, points)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            displayname = VALUES(displayname),
            points = VALUES(points)
          `,
          [playoffsScoreRows],
          { guildId, scope: 'cron:calculateScores', label: 'batch upsert playoffs_scores' }
        );
      }

      logger.info('scores', 'Playoffs calculated', {
        guildId,
        users: playoffsScoreRows.length,
        scope: 'cron:calculateScores',
      });
    }
  } catch (err) {
    logger.error('scores', 'Playoffs calculation failed', {
      guildId,
      scope: 'cron:calculateScores',
      message: err.message,
      stack: err.stack,
    });
  }

  /* =========================
     DOUBLE ELIMINATION
     ========================= */
  try {
    const [doubleResultsRows] = await safeQuery(
      pool,
      `SELECT * FROM doubleelim_results WHERE guild_id = ? AND active = 1 ORDER BY id DESC LIMIT 1`,
      [guildId],
      { guildId, scope: 'cron:calculateScores', label: 'select doubleelim_results' }
    );

    if (!doubleResultsRows.length) {
      logger.warn('scores', 'No active Double Elim results', {
        guildId,
        scope: 'cron:calculateScores',
      });
    } else {
      const correctDouble = doubleResultsRows[0];

      const [doublePredictions] = await safeQuery(
        pool,
        `
        SELECT p.*
        FROM doubleelim_predictions p
        JOIN (
          SELECT user_id, MAX(submitted_at) AS ms
          FROM doubleelim_predictions
          WHERE guild_id = ?
          GROUP BY user_id
          ) last
           ON last.user_id = p.user_id
          AND last.ms = p.submitted_at
          WHERE p.guild_id = ?
          AND p.active = 1
        `,
        [guildId, guildId],
        { guildId, scope: 'cron:calculateScores', label: 'select doubleelim_predictions' }
      );

      const [nameRows] = await safeQuery(
        pool,
        `
        SELECT user_id, displayname
        FROM doubleelim_predictions
        WHERE guild_id = ?
          AND displayname IS NOT NULL
          AND displayname != ''
        `,
        [guildId],
        { guildId, scope: 'cron:calculateScores', label: 'preload doubleelim displaynames' }
      );

      const displayNameMap = new Map(
        nameRows.map(r => [r.user_id, r.displayname])
      );

      const doubleElimScoreRows = [];

      for (const pred of doublePredictions) {
        const user_id = pred.user_id;
        const displayname =
          pred.displayname ||
          displayNameMap.get(user_id) ||
          user_id;

        let score = 0;
        cleanList(pred.upper_final_a).forEach(t => {
          if (cleanList(correctDouble.upper_final_a).includes(t)) score += 1;
        });
        cleanList(pred.lower_final_a).forEach(t => {
          if (cleanList(correctDouble.lower_final_a).includes(t)) score += 1;
        });
        cleanList(pred.upper_final_b).forEach(t => {
          if (cleanList(correctDouble.upper_final_b).includes(t)) score += 1;
        });
        cleanList(pred.lower_final_b).forEach(t => {
          if (cleanList(correctDouble.lower_final_b).includes(t)) score += 1;
        });

        doubleElimScoreRows.push([
          guildId,
          user_id,
          displayname,
          score,
        ]);
      }

      if (doubleElimScoreRows.length) {
        await safeQuery(
          pool,
          `
          INSERT INTO doubleelim_scores (guild_id, user_id, displayname, points)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            displayname = VALUES(displayname),
            points = VALUES(points)
          `,
          [doubleElimScoreRows],
          { guildId, scope: 'cron:calculateScores', label: 'batch upsert doubleelim_scores' }
        );
      }

      logger.info('scores', 'Double Elim calculated', {
        guildId,
        users: doubleElimScoreRows.length,
        scope: 'cron:calculateScores',
      });
    }
  } catch (err) {
    logger.error('scores', 'Double Elim calculation failed', {
      guildId,
      scope: 'cron:calculateScores',
      message: err.message,
      stack: err.stack,
    });
  }

  /* =========================
     PLAY-IN
     ========================= */
  try {
    const [playinResultsRows] = await safeQuery(
      pool,
      `SELECT * FROM playin_results WHERE guild_id = ? and ACTIVE = 1 ORDER BY id DESC LIMIT 1`,
      [guildId],
      { guildId, scope: 'cron:calculateScores', label: 'select playin_results' }
    );

    if (!playinResultsRows.length) {
      logger.warn('scores', 'No active Play-In results', {
        guildId,
        scope: 'cron:calculateScores',
      });
    } else {
      const correctPlayin = playinResultsRows[0];

      const [playinPredictions] = await safeQuery(
        pool,
        `SELECT * FROM playin_predictions WHERE guild_id = ? AND active = 1`,
        [guildId],
        { guildId, scope: 'cron:calculateScores', label: 'select playin_predictions' }
      );

      const [nameRows] = await safeQuery(
        pool,
        `
        SELECT user_id, displayname
        FROM playin_predictions
        WHERE guild_id = ?
        AND displayname IS NOT NULL
          AND displayname != ''
        `,
        [guildId],
        { guildId, scope: 'cron:calculateScores', label: 'preload playin displaynames' }
      );

      const displayNameMap = new Map(
        nameRows.map(r => [r.user_id, r.displayname])
      );

      const playinScoreRows = [];
      const correctTeams = cleanList(correctPlayin.correct_teams);

      for (const pred of playinPredictions) {
        const user_id = pred.user_id;
        const displayname =
          pred.displayname ||
          displayNameMap.get(user_id) ||
          user_id;

        let score = 0;
        cleanList(pred.teams).forEach(t => {
          if (correctTeams.includes(t)) score += 1;
        });

        playinScoreRows.push([
          guildId,
          user_id,
          displayname,
          score,
        ]);
      }

      if (playinScoreRows.length) {
        await safeQuery(
          pool,
          `
          INSERT INTO playin_scores (guild_id, user_id, displayname, points)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            displayname = VALUES(displayname),
            points = VALUES(points)
          `,
          [playinScoreRows],
          { guildId, scope: 'cron:calculateScores', label: 'batch upsert playin_scores' }
        );
      }

      logger.info('scores', 'Play-In calculated', {
        guildId,
        users: playinScoreRows.length,
        scope: 'cron:calculateScores',
      });
    }
  } catch (err) {
    logger.error('scores', 'Play-In calculation failed', {
      guildId,
      scope: 'cron:calculateScores',
      message: err.message,
      stack: err.stack,
    });
  }

  /* =========================
     MATCHES
     ========================= */
  try {
    const [matchesWithResults] = await safeQuery(
      pool,
      `
      SELECT
        m.id AS match_id,
        r.res_a, r.res_b,
        r.exact_a, r.exact_b
      FROM matches m
      JOIN match_results r
        ON r.match_id = m.id
        AND r.guild_id = m.guild_id
      WHERE m.guild_id = ?
      `,
      [guildId],
      { guildId, scope: 'cron:calculateScores', label: 'select matches with results' }
    );

    if (!matchesWithResults.length) {
      logger.warn('scores', 'No matches with official results', {
        guildId,
        scope: 'cron:calculateScores',
      });
    } else {
      const matchIds = matchesWithResults.map(m => m.match_id);

      const [allPredictions] = await safeQuery(
        pool,
        `
        SELECT match_id, user_id, pred_a, pred_b, pred_exact_a, pred_exact_b
        FROM match_predictions
        WHERE guild_id = ?
          AND match_id IN (?)
        `,
        [guildId, matchIds],
        { guildId, scope: 'cron:calculateScores', label: 'select match_predictions bulk' }
      );

      const predsByMatch = new Map();
      for (const p of allPredictions) {
        if (!predsByMatch.has(p.match_id)) predsByMatch.set(p.match_id, []);
        predsByMatch.get(p.match_id).push(p);
      }

      const matchPointRows = [];

      for (const m of matchesWithResults) {
        const preds = predsByMatch.get(m.match_id) || [];
        for (const p of preds) {
          const pts = computeTotalPoints({
            predA: p.pred_a,
            predB: p.pred_b,
            resA: m.res_a,
            resB: m.res_b,
            predExactA: p.pred_exact_a ?? null,
            predExactB: p.pred_exact_b ?? null,
            exactA: m.exact_a ?? null,
            exactB: m.exact_b ?? null
          });

          matchPointRows.push([guildId, m.match_id, p.user_id, pts]);
        }
      }

      if (matchPointRows.length) {
        await safeQuery(
          pool,
          `
          INSERT INTO match_points (guild_id, match_id, user_id, points)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            points = VALUES(points),
            computed_at = CURRENT_TIMESTAMP
          `,
          [matchPointRows],
          { guildId, scope: 'cron:calculateScores', label: 'batch upsert match_points' }
        );
      }

      logger.info('scores', 'Match points calculated', {
        guildId,
        rows: matchPointRows.length,
        scope: 'cron:calculateScores',
      });
    }
  } catch (err) {
    logger.error('scores', 'Match calculation failed', {
      guildId,
      scope: 'cron:calculateScores',
      message: err.message,
      stack: err.stack,
    });
  }

  logger.info('scores', 'Score calculation finished', {
    guildId,
    scope: 'cron:calculateScores',
  });
};
