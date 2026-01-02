const pool = require('../db');
const { getGuildId } = require('../utils/guildContext');
const logger = require('../utils/logger');

const cleanList = (val) => {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) { }
  return String(val)
    .replace(/[\[\]"]+/g, '')
    .split(/[;,]+/)
    .map(t => t.trim())
    .filter(Boolean);
};

module.exports = async function calculateScores() {
  // ✅ Walidacja: upewnij się, że jesteśmy w kontekście guilda
  const guildId = getGuildId();
  if (!guildId) {
    const error = new Error('calculateScores called without guild context');
    logger.error('scores', 'calculateScores called without guild context', {});
    throw error;
  }

  logger.info('scores', 'Starting score calculation', { guildId });
  console.log('⚙️ Rozpoczynam przeliczanie punktów...');

  // === SWISS ===
  try {
    console.log('📦 Przeliczam fazę SWISS...');
    const [swissResultsRows] = await pool.query(`SELECT * FROM swiss_results WHERE active = 1`);
    if (!swissResultsRows.length) {
      console.warn('⚠️ Brak aktywnych oficjalnych wyników Swiss');
    } else {
      for (const correctSwiss of swissResultsRows) {
        const stageRaw = correctSwiss.stage;         // np. "stage1"
        const stage = stageRaw.replace('stage', ''); // np. "1"

        const correct30 = cleanList(correctSwiss.correct_3_0);
        const correct03 = cleanList(correctSwiss.correct_0_3);
        const correctAdv = cleanList(correctSwiss.correct_advancing);
        console.log(`✅ Oficjalne wyniki Swiss (stage: ${stage}):`);
        console.log(' - 3-0:', correct30);
        console.log(' - 0-3:', correct03);
        console.log(' - Awans:', correctAdv);

        const [swissPredictions] = await pool.query(
          `SELECT * FROM swiss_predictions WHERE stage = ?`,
          [stageRaw]
        );

        for (const pred of swissPredictions) {
          const user_id = pred.user_id;
          let displayname = pred.displayname;
          if (!displayname || displayname === user_id) {
            const [nameRow] = await pool.query(
              `SELECT displayname FROM swiss_predictions WHERE user_id = ? AND stage = ? LIMIT 1`,
              [user_id, stageRaw]
            );
            displayname = nameRow[0]?.displayname || user_id;
          }

          const pick30 = cleanList(pred.pick_3_0);
          const pick03 = cleanList(pred.pick_0_3);
          const adv = cleanList(pred.advancing);
          console.log(`👤 ${displayname} (user_id: ${user_id}) | stage: ${stage}`);
          console.log(' - Typ 3-0:', pick30);
          console.log(' - Typ 0-3:', pick03);
          console.log(' - Typ Awans:', adv);

          let score = 0;
          pick30.forEach(t => { if (correct30.includes(t)) score += 4; });
          pick03.forEach(t => { if (correct03.includes(t)) score += 4; });
          adv.forEach(t => { if (correctAdv.includes(t)) score += 2; });
          console.log(`🎯 Punkty dla ${displayname}: ${score}`);
          console.log('-----------------------------');

          // ⬇️ ZMIANA: zapis do kolumny `points` (zamiast `score`)
          await pool.query(
            `INSERT INTO swiss_scores (user_id, stage, displayname, points)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE displayname = VALUES(displayname), points = ?`,
            [user_id, stage, displayname, score, score]
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
    const [playoffsResultsRows] = await pool.query(
      `SELECT * FROM playoffs_results WHERE active = 1 ORDER BY id DESC LIMIT 1`
    );
    const correctPlayoffs = playoffsResultsRows[0];
    if (!correctPlayoffs) {
      console.warn('⚠️ Brak aktywnych oficjalnych wyników Playoffs');
    } else {
      const [playoffsPredictions] = await pool.query(
        `SELECT * FROM playoffs_predictions WHERE active = 1`
      );
      for (const pred of playoffsPredictions) {
        const user_id = pred.user_id;
        let displayname = pred.displayname;
        if (!displayname || displayname === user_id) {
          const [nameRow] = await pool.query(
            `SELECT displayname FROM playoffs_predictions WHERE user_id = ? LIMIT 1`,
            [user_id]
          );
          displayname = nameRow[0]?.displayname || user_id;
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

        await pool.query(
          `INSERT INTO playoffs_scores (user_id, displayname, points)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE displayname = VALUES(displayname), points = ?`,
          [user_id, displayname, score, score]
        );
      }
    }
  } catch (err) {
    console.error('❌ Błąd w fazie PLAYOFFS:', err);
  }

  // === DOUBLE ELIMINATION ===
  // === DOUBLE ELIMINATION ===
  try {
    console.log('📦 Przeliczam fazę DOUBLE ELIM...');
    const [doubleResultsRows] = await pool.query(
      `SELECT * FROM doubleelim_results WHERE active = 1 ORDER BY id DESC LIMIT 1`
    );
    const correctDouble = doubleResultsRows[0];
    if (!correctDouble) {
      console.warn('⚠️ Brak aktywnych oficjalnych wyników Double Elim');
    } else {
      // ⬇️ Weź ostatnie typy per user (bez 'active')
      const [doublePredictions] = await pool.query(
        `
      SELECT p.*
      FROM doubleelim_predictions p
      JOIN (
        SELECT user_id, MAX(submitted_at) AS ms
        FROM doubleelim_predictions
        GROUP BY user_id
      ) last ON last.user_id = p.user_id AND last.ms = p.submitted_at
      `
      );

      for (const pred of doublePredictions) {
        const user_id = pred.user_id;
        let displayname = pred.displayname;
        if (!displayname || displayname === user_id) {
          const [nameRow] = await pool.query(
            `SELECT displayname FROM doubleelim_predictions WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 1`,
            [user_id]
          );
          displayname = nameRow[0]?.displayname || user_id;
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

        await pool.query(
          `INSERT INTO doubleelim_scores (user_id, displayname, points)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE displayname = VALUES(displayname), points = ?`,
          [user_id, displayname, score, score]
        );
      }
    }
  } catch (err) {
    console.error('❌ Błąd w fazie DOUBLE ELIM:', err);
  }

  // === PLAY-IN ===
  try {
    console.log('📦 Przeliczam fazę PLAY-IN...');
    const [playinResultsRows] = await pool.query(
      `SELECT * FROM playin_results WHERE active = 1 ORDER BY id DESC LIMIT 1`
    );
    const correctPlayin = playinResultsRows[0];
    if (!correctPlayin) {
      console.warn('⚠️ Brak aktywnych oficjalnych wyników Play-In');
    } else {
      const [playinPredictions] = await pool.query(
        `SELECT * FROM playin_predictions WHERE active = 1`
      );
      for (const pred of playinPredictions) {
        const user_id = pred.user_id;
        let displayname = pred.displayname;
        if (!displayname || displayname === user_id) {
          const [nameRow] = await pool.query(
            `SELECT displayname FROM playin_predictions WHERE user_id = ? LIMIT 1`,
            [user_id]
          );
          displayname = nameRow[0]?.displayname || user_id;
        }

        const teams = cleanList(pred.teams);
        const correctTeams = cleanList(correctPlayin.correct_teams);

        let score = 0;
        teams.forEach(t => { if (correctTeams.includes(t)) score += 1; });

        await pool.query(
          `INSERT INTO playin_scores (user_id, displayname, points)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE displayname = VALUES(displayname), points = ?`,
          [user_id, displayname, score, score]
        );
      }
    }
  } catch (err) {
    console.error('❌ Błąd w fazie PLAY-IN:', err);
  }

  // === MATCHES (wyniki meczów) ===
  try {
    console.log('📦 Przeliczam punkty za WYNIKI MECZÓW...');

    // wszystkie mecze, które mają ustawiony oficjalny wynik
    const [matchesWithResults] = await pool.query(`
      SELECT m.id, m.team_a, m.team_b, m.phase, r.res_a, r.res_b
      FROM matches m
      JOIN match_results r ON r.match_id = m.id
      ORDER BY m.id ASC
      `);

    let totalComputed = 0;

    for (const m of matchesWithResults) {
      const [preds] = await pool.query(
        `SELECT user_id, pred_a, pred_b FROM match_predictions WHERE match_id = ?`,
        [m.id]
      );

      for (const p of preds) {
        const pts = computePoints({
          predA: p.pred_a,
          predB: p.pred_b,
          resA: m.res_a,
          resB: m.res_b
        });

        await pool.query(
          `INSERT INTO match_points (match_id, user_id, points)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE points = VALUES(points), computed_at = CURRENT_TIMESTAMP`,
          [m.id, p.user_id, pts]
        );

        totalComputed++;
      }
    }

    console.log(`✅ Mecze przeliczone. Zaktualizowana wpisów match_points: ${totalComputed}`);
  } catch (err) {
    console.error('❌ Błąd w fazie MATCHES:', err);
  }

  console.log('✅ Przeliczanie zakończone.');
};




//test