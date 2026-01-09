const db = require('../db');
const { getGuildId } = require('../utils/guildContext');
const logger = require('../utils/logger');
const { safeQuery } = require('../utils/safeQuery');

const cleanList = (val) => {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) { }
  return String(val)
    .replace(/[\[\]"]+/g, '')
    .split(/[;,]+/)
    .map(t => t.trim())
    .filter(Boolean);
};

module.exports = async function calculateScores() {
  // ✅ Walidacja kontekstu guild
  const guildId = getGuildId();
  if (!guildId) {
    logger.error('scores', 'calculateScores called without guild context', {});
    throw new Error('calculateScores called without guild context');
  }

  const pool = db.getPoolForGuild(guildId);

  logger.info('scores', 'Starting score calculation', { guildId });
  console.log('⚙️ Rozpoczynam przeliczanie punktów...');

  // === SWISS ===
  try {
    console.log('📦 Przeliczam fazę SWISS...');
    const [swissResultsRows] = await safeQuery(
      pool,
      `SELECT * FROM swiss_results WHERE active = 1`,
      [],
      { guildId, scope: 'cron:calculateScores', label: 'select swiss_results' }
    );

    if (!swissResultsRows.length) {
      console.warn('⚠️ Brak aktywnych oficjalnych wyników Swiss');
    } else {
      for (const correctSwiss of swissResultsRows) {
        const stageRaw = correctSwiss.stage;
        const stage = stageRaw.replace('stage', '');

        const correct30 = cleanList(correctSwiss.correct_3_0);
        const correct03 = cleanList(correctSwiss.correct_0_3);
        const correctAdv = cleanList(correctSwiss.correct_advancing);

        console.log(`✅ Oficjalne wyniki Swiss (stage: ${stage}):`);
        console.log(' - 3-0:', correct30);
        console.log(' - 0-3:', correct03);
        console.log(' - Awans:', correctAdv);

        const [swissPredictions] = await safeQuery(
          pool,
          `SELECT * FROM swiss_predictions WHERE stage = ?`,
          [stageRaw],
          { guildId, scope: 'cron:calculateScores', label: 'select swiss_predictions' }
        );

        const [nameRows] = await safeQuery(
          pool,
          `
  SELECT user_id, displayname
  FROM swiss_predictions
  WHERE stage = ?
    AND displayname IS NOT NULL
    AND displayname != ''
  `,
          [stageRaw],
          { guildId, scope: 'cron:calculateScores', label: 'preload swiss displaynames' }
        );

        const displayNameMap = new Map(
          nameRows.map(r => [r.user_id, r.displayname])
        );
        const swissScoreRows = [];



        for (const pred of swissPredictions) {
          const user_id = pred.user_id;
          let displayname = pred.displayname;

          if (!displayname || displayname === user_id) {
            displayname = displayNameMap.get(user_id) || user_id;
          }

          const pick30 = cleanList(pred.pick_3_0);
          const pick03 = cleanList(pred.pick_0_3);
          const adv = cleanList(pred.advancing);

          let score = 0;
          pick30.forEach(t => { if (correct30.includes(t)) score += 4; });
          pick03.forEach(t => { if (correct03.includes(t)) score += 4; });
          adv.forEach(t => { if (correctAdv.includes(t)) score += 2; });

          swissScoreRows.push([
            user_id,
            stage,
            displayname,
            score
            
          ]);
        }
        if (swissScoreRows.length) {
          await safeQuery(
            pool,
            `
    INSERT INTO swiss_scores (user_id, stage, displayname, points)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      displayname = VALUES(displayname),
      points = VALUES(points)
    `,
            [swissScoreRows],
            { guildId, scope: 'cron:calculateScores', label: 'batch upsert swiss_scores' }
          );
        }


      }
    }
  } catch (err) {
    console.error('❌ Błąd w fazie SWISS:', err);
  }

  // === PLAYOFFS ===
  try {
    console.log('📦 Przeliczam fazę PLAYOFFS...');
    const [playoffsResultsRows] = await safeQuery(
      pool,
      `SELECT * FROM playoffs_results WHERE active = 1 ORDER BY id DESC LIMIT 1`,
      [],
      { guildId, scope: 'cron:calculateScores', label: 'select playoffs_results' }
    );

    const correctPlayoffs = playoffsResultsRows[0];
    if (!correctPlayoffs) {
      console.warn('⚠️ Brak aktywnych oficjalnych wyników Playoffs');
    } else {
      const [playoffsPredictions] = await safeQuery(
        pool,
        `SELECT * FROM playoffs_predictions WHERE active = 1`,
        [],
        { guildId, scope: 'cron:calculateScores', label: 'select playoffs_predictions' }
      );

      const playoffsScoreRows = [];

      const [nameRows] = await safeQuery(
        pool,
        `
  SELECT user_id, displayname
  FROM playoffs_predictions
  WHERE displayname IS NOT NULL
    AND displayname != ''
  `,
        [],
        { guildId, scope: 'cron:calculateScores', label: 'preload playoffs displaynames' }
      );

      const displayNameMap = new Map(
        nameRows.map(r => [r.user_id, r.displayname])
      );



      for (const pred of playoffsPredictions) {
        const user_id = pred.user_id;
        let displayname = pred.displayname;

        if (!displayname || displayname === user_id) {
          displayname = displayNameMap.get(user_id) || user_id;
        }


        const semis = cleanList(pred.semifinalists);
        const finals = cleanList(pred.finalists);
        const winner = pred.winner;
        const third = pred.third_place_winner;

        const correctSemis = cleanList(correctPlayoffs.correct_semifinalists);
        const correctFinals = cleanList(correctPlayoffs.correct_finalists);
        const correctWinner = correctPlayoffs.correct_winner;
        const correctThird = correctPlayoffs.correct_third_place_winner;

        let score = 0;
        semis.forEach(t => { if (correctSemis.includes(t)) score += 1; });
        finals.forEach(t => { if (correctFinals.includes(t)) score += 2; });
        if (winner === correctWinner) score += 3;
        if (third && third === correctThird) score += 2;

        playoffsScoreRows.push([
          user_id,
          displayname,
          score,
          
        ]);

      }
      if (playoffsScoreRows.length) {
        await safeQuery(
          pool,
          `
    INSERT INTO playoffs_scores (user_id, displayname, points)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      displayname = VALUES(displayname),
      points = VALUES(points)
    `,
          [playoffsScoreRows],
          { guildId, scope: 'cron:calculateScores', label: 'batch upsert playoffs_scores' }
        );
      }

    }
  } catch (err) {
    console.error('❌ Błąd w fazie PLAYOFFS:', err);
  }

  // === DOUBLE ELIMINATION ===
  try {
    console.log('📦 Przeliczam fazę DOUBLE ELIM...');
    const [doubleResultsRows] = await safeQuery(
      pool,
      `SELECT * FROM doubleelim_results WHERE active = 1 ORDER BY id DESC LIMIT 1`,
      [],
      { guildId, scope: 'cron:calculateScores', label: 'select doubleelim_results' }
    );

    const correctDouble = doubleResultsRows[0];
    if (!correctDouble) {
      console.warn('⚠️ Brak aktywnych oficjalnych wyników Double Elim');
    } else {
      const [doublePredictions] = await safeQuery(
        pool,
        `
        SELECT p.*
        FROM doubleelim_predictions p
        JOIN (
          SELECT user_id, MAX(submitted_at) AS ms
          FROM doubleelim_predictions
          GROUP BY user_id
        ) last ON last.user_id = p.user_id AND last.ms = p.submitted_at
        `,
        [],
        { guildId, scope: 'cron:calculateScores', label: 'select doubleelim_predictions' }
      );

      const doubleElimScoreRows = [];

      const [nameRows] = await safeQuery(
        pool,
        `
  SELECT user_id, displayname
  FROM doubleelim_predictions
  WHERE displayname IS NOT NULL
    AND displayname != ''
  `,
        [],
        { guildId, scope: 'cron:calculateScores', label: 'preload doubleelim displaynames' }
      );

      const displayNameMap = new Map(
        nameRows.map(r => [r.user_id, r.displayname])
      );



      for (const pred of doublePredictions) {
        const user_id = pred.user_id;
        let displayname = pred.displayname;

        if (!displayname || displayname === user_id) {
          displayname = displayNameMap.get(user_id) || user_id;
        }

        const ua = cleanList(pred.upper_final_a);
        const la = cleanList(pred.lower_final_a);
        const ub = cleanList(pred.upper_final_b);
        const lb = cleanList(pred.lower_final_b);

        const correctUA = cleanList(correctDouble.upper_final_a);
        const correctLA = cleanList(correctDouble.lower_final_a);
        const correctUB = cleanList(correctDouble.upper_final_b);
        const correctLB = cleanList(correctDouble.lower_final_b);

        let score = 0;
        ua.forEach(t => { if (correctUA.includes(t)) score += 1; });
        la.forEach(t => { if (correctLA.includes(t)) score += 1; });
        ub.forEach(t => { if (correctUB.includes(t)) score += 1; });
        lb.forEach(t => { if (correctLB.includes(t)) score += 1; });

        doubleElimScoreRows.push([
          user_id,
          displayname,
          score
        ]);
      }
      if (doubleElimScoreRows.length) {
        await safeQuery(
          pool,
          `
    INSERT INTO doubleelim_scores (user_id, displayname, points)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      displayname = VALUES(displayname),
      points = VALUES(points)
    `,
          [doubleElimScoreRows],
          { guildId, scope: 'cron:calculateScores', label: 'batch upsert doubleelim_scores' }
        );
      }

    }
  } catch (err) {
    console.error('❌ Błąd w fazie DOUBLE ELIM:', err);
  }

  // === PLAY-IN ===
  try {
    console.log('📦 Przeliczam fazę PLAY-IN...');
    const [playinResultsRows] = await safeQuery(
      pool,
      `SELECT * FROM playin_results WHERE active = 1 ORDER BY id DESC LIMIT 1`,
      [],
      { guildId, scope: 'cron:calculateScores', label: 'select playin_results' }
    );

    const correctPlayin = playinResultsRows[0];
    if (!correctPlayin) {
      console.warn('⚠️ Brak aktywnych oficjalnych wyników Play-In');
    } else {
      const [playinPredictions] = await safeQuery(
        pool,
        `SELECT * FROM playin_predictions WHERE active = 1`,
        [],
        { guildId, scope: 'cron:calculateScores', label: 'select playin_predictions' }
      );

      // preload displayname
      const [nameRows] = await safeQuery(
        pool,
        `
        SELECT user_id, displayname
        FROM playin_predictions
        WHERE displayname IS NOT NULL
          AND displayname != ''
      `,
        [],
        { guildId, scope: 'cron:calculateScores', label: 'preload playin displaynames' }
      );

      const displayNameMap = new Map(
        nameRows.map(r => [r.user_id, r.displayname])
      );

      const playinScoreRows = [];
      const correctTeams = cleanList(correctPlayin.correct_teams);

      for (const pred of playinPredictions) {
        const user_id = pred.user_id;
        let displayname = pred.displayname;

        if (!displayname || displayname === user_id) {
          displayname = displayNameMap.get(user_id) || user_id;
        }

        const teams = cleanList(pred.teams);

        let score = 0;
        teams.forEach(t => {
          if (correctTeams.includes(t)) score += 1;
        });

        playinScoreRows.push([
          user_id,
          displayname,
          score
        ]);
      }

      if (playinScoreRows.length) {
        await safeQuery(
          pool,
          `
          INSERT INTO playin_scores (user_id, displayname, points)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            displayname = VALUES(displayname),
            points = VALUES(points)
        `,
          [playinScoreRows],
          { guildId, scope: 'cron:calculateScores', label: 'batch upsert playin_scores' }
        );
      }
    }
  } catch (err) {
    console.error('❌ Błąd w fazie PLAY-IN:', err);
  }

  // === MATCHES ===
  try {
    console.log('📦 Przeliczam punkty za WYNIKI MECZÓW...');

    // 1) Wszystkie mecze z oficjalnym wynikiem
    const [matchesWithResults] = await safeQuery(
      pool,
      `
      SELECT m.id AS match_id, r.res_a, r.res_b
      FROM matches m
      JOIN match_results r ON r.match_id = m.id
      ORDER BY m.id ASC
    `,
      [],
      { guildId, scope: 'cron:calculateScores', label: 'select matches with results' }
    );

    if (!matchesWithResults.length) {
      console.warn('⚠️ Brak meczów z oficjalnym wynikiem');
      return;
    }

    // 2) Wszystkie predykcje do tych meczów (jednym strzałem)
    const matchIds = matchesWithResults.map(m => m.match_id);

    const [allPredictions] = await safeQuery(
      pool,
      `
      SELECT match_id, user_id, pred_a, pred_b
      FROM match_predictions
      WHERE match_id IN (?)
    `,
      [matchIds],
      { guildId, scope: 'cron:calculateScores', label: 'select match_predictions bulk' }
    );

    // 3) Grupowanie predykcji po match_id
    const predsByMatch = new Map();
    for (const p of allPredictions) {
      if (!predsByMatch.has(p.match_id)) {
        predsByMatch.set(p.match_id, []);
      }
      predsByMatch.get(p.match_id).push(p);
    }

    // 4) Liczenie punktów (bez DB)
    const matchPointRows = [];

    for (const m of matchesWithResults) {
      const preds = predsByMatch.get(m.match_id) || [];

      for (const p of preds) {
        const pts = computePoints({
          predA: p.pred_a,
          predB: p.pred_b,
          resA: m.res_a,
          resB: m.res_b,
        });

        matchPointRows.push([
          m.match_id,
          p.user_id,
          pts,
        ]);
      }
    }

    // 5) Batch INSERT
    if (matchPointRows.length) {
      await safeQuery(
        pool,
        `
        INSERT INTO match_points (match_id, user_id, points)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          points = VALUES(points),
          computed_at = CURRENT_TIMESTAMP
      `,
        [matchPointRows],
        { guildId, scope: 'cron:calculateScores', label: 'batch upsert match_points' }
      );
    }

    console.log(`✅ MATCHES: zapisano ${matchPointRows.length} wpisów`);
  } catch (err) {
    console.error('❌ Błąd w fazie MATCHES:', err);
  }


  console.log('✅ Przeliczanie zakończone.');
};
