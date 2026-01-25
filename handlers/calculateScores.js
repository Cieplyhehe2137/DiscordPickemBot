const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');
const { computeTotalPoints } = require('../utils/matchScoring');

// =========================
// HELPERY
// =========================
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
    throw new Error('calculateScores called without guildId');
  }

  logger.info('scores', 'Score calculation started', { guildId });

  await withGuild(guildId, async ({ pool, guildId }) => {

    /* =========================
       SWISS
       ========================= */
    try {
      const [swissResultsRows] = await pool.query(
        `
        SELECT *
        FROM swiss_results
        WHERE guild_id = ?
          AND active = 1
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId]
      );

      if (!swissResultsRows.length) {
        logger.warn('scores', 'No active Swiss results', { guildId });
      }

      for (const correctSwiss of swissResultsRows) {
        const stage = correctSwiss.stage;

        const correct30  = cleanList(correctSwiss.correct_3_0);
        const correct03  = cleanList(correctSwiss.correct_0_3);
        const correctAdv = cleanList(correctSwiss.correct_advancing);

        const [swissPredictions] = await pool.query(
          `SELECT * FROM swiss_predictions WHERE guild_id = ? AND stage = ?`,
          [guildId, stage]
        );

        const [nameRows] = await pool.query(
          `
          SELECT user_id, displayname
          FROM swiss_predictions
          WHERE guild_id = ?
            AND stage = ?
            AND displayname IS NOT NULL
            AND displayname != ''
          `,
          [guildId, stage]
        );

        const displayNameMap = new Map(
          nameRows.map(r => [r.user_id, r.displayname])
        );

        const scoreRows = [];

        for (const pred of swissPredictions) {
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

          scoreRows.push([
            guildId,
            pred.user_id,
            stage,
            pred.displayname || displayNameMap.get(pred.user_id) || pred.user_id,
            score,
          ]);
        }

        if (scoreRows.length) {
          await pool.query(
            `
            INSERT INTO swiss_scores (guild_id, user_id, stage, displayname, points)
            VALUES ?
            ON DUPLICATE KEY UPDATE
              displayname = VALUES(displayname),
              points = VALUES(points)
            `,
            [scoreRows]
          );
        }

        logger.info('scores', 'Swiss calculated', {
          guildId,
          stage,
          users: scoreRows.length,
        });
      }
    } catch (err) {
      logger.error('scores', 'Swiss calculation failed', {
        guildId,
        message: err.message,
        stack: err.stack,
      });
    }

    /* =========================
       PLAYOFFS
       ========================= */
    try {
      const [rows] = await pool.query(
        `
        SELECT *
        FROM playoffs_results
        WHERE guild_id = ?
          AND active = 1
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId]
      );

      if (!rows.length) return;

      const correct = rows[0];

      const [preds] = await pool.query(
        `SELECT * FROM playoffs_predictions WHERE guild_id = ? AND active = 1`,
        [guildId]
      );

      const scoreRows = [];

      for (const p of preds) {
        let score = 0;

        cleanList(p.semifinalists).forEach(t => {
          if (cleanList(correct.correct_semifinalists).includes(t)) score += 1;
        });
        cleanList(p.finalists).forEach(t => {
          if (cleanList(correct.correct_finalists).includes(t)) score += 2;
        });

        if (p.winner === correct.correct_winner) score += 3;
        if (p.third_place_winner === correct.correct_third_place_winner) score += 2;

        scoreRows.push([guildId, p.user_id, p.displayname || p.user_id, score]);
      }

      if (scoreRows.length) {
        await pool.query(
          `
          INSERT INTO playoffs_scores (guild_id, user_id, displayname, points)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            displayname = VALUES(displayname),
            points = VALUES(points)
          `,
          [scoreRows]
        );
      }

      logger.info('scores', 'Playoffs calculated', {
        guildId,
        users: scoreRows.length,
      });
    } catch (err) {
      logger.error('scores', 'Playoffs calculation failed', {
        guildId,
        message: err.message,
        stack: err.stack,
      });
    }

    /* =========================
       MATCHES
       ========================= */
    try {
      const [matches] = await pool.query(
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
        [guildId]
      );

      if (!matches.length) return;

      const matchIds = matches.map(m => m.match_id);

      const [preds] = await pool.query(
        `
        SELECT match_id, user_id, pred_a, pred_b, pred_exact_a, pred_exact_b
        FROM match_predictions
        WHERE guild_id = ?
          AND match_id IN (?)
        `,
        [guildId, matchIds]
      );

      const predsByMatch = new Map();
      for (const p of preds) {
        if (!predsByMatch.has(p.match_id)) predsByMatch.set(p.match_id, []);
        predsByMatch.get(p.match_id).push(p);
      }

      const rows = [];

      for (const m of matches) {
        const ps = predsByMatch.get(m.match_id) || [];
        for (const p of ps) {
          const pts = computeTotalPoints({
            predA: p.pred_a,
            predB: p.pred_b,
            resA: m.res_a,
            resB: m.res_b,
            predExactA: p.pred_exact_a,
            predExactB: p.pred_exact_b,
            exactA: m.exact_a,
            exactB: m.exact_b,
          });

          rows.push([guildId, m.match_id, p.user_id, pts]);
        }
      }

      if (rows.length) {
        await pool.query(
          `
          INSERT INTO match_points (guild_id, match_id, user_id, points)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            points = VALUES(points),
            computed_at = CURRENT_TIMESTAMP
          `,
          [rows]
        );
      }

      logger.info('scores', 'Match points calculated', {
        guildId,
        rows: rows.length,
      });
    } catch (err) {
      logger.error('scores', 'Match calculation failed', {
        guildId,
        message: err.message,
        stack: err.stack,
      });
    }

    logger.info('scores', 'Score calculation finished', { guildId });
  });
};
