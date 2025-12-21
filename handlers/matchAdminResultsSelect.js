// handlers/matchAdminResultSelect.js
const pool = require('../db');
const logger = require('../utils/logger');
const { computePoints } = require('../utils/matchScoring'); // upewnij się, że eksportujesz computePoints

module.exports = async function matchAdminResultSelect(interaction) {
  const picked = interaction.values?.[0];
  if (!picked) return interaction.deferUpdate();

  const [matchIdStr, resAStr, resBStr] = picked.split('|');
  const matchId = Number(matchIdStr);
  const resA = Number(resAStr);
  const resB = Number(resBStr);

  if (!matchId || Number.isNaN(resA) || Number.isNaN(resB)) {
    return interaction.update({ content: '❌ Niepoprawne dane wyniku.', components: [] });
  }

  // 1) upsert wyniku
  await pool.query(
    `
    INSERT INTO match_results (match_id, res_a, res_b)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE res_a = VALUES(res_a), res_b = VALUES(res_b)
    `,
    [matchId, resA, resB]
  );

  // 2) przelicz punkty (kasujemy stare, liczymy na nowo)
  await pool.query(`DELETE FROM match_points WHERE match_id = ?`, [matchId]);

  const [preds] = await pool.query(
    `SELECT user_id, pred_a, pred_b FROM match_predictions WHERE match_id = ?`,
    [matchId]
  );

  if (preds.length) {
    const values = preds.map(p => {
      const points = computePoints({
        predA: Number(p.pred_a),
        predB: Number(p.pred_b),
        resA,
        resB
      });
      return [matchId, p.user_id, points];
    });

    // batch insert
    await pool.query(
      `INSERT INTO match_points (match_id, user_id, points) VALUES ?`,
      [values]
    );
  }

  logger?.info?.('matches', 'Match result set', { matchId, resA, resB, by: interaction.user.id });

  return interaction.update({
    content: `✅ Ustawiono wynik meczu **#${matchId}**: **${resA}:${resB}**\nPunkty zostały przeliczone.`,
    components: []
  });
};
