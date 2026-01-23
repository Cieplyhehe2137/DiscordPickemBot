// handlers/matchAdminResultSelect.js
const db = require('../db');
const logger = require('../utils/logger');
const { computeTotalPoints } = require('../utils/matchScoring');

module.exports = async function matchAdminResultSelect(interaction) {
  const picked = interaction.values?.[0];
  if (!picked) return interaction.deferUpdate();

  const [matchIdStr, resAStr, resBStr] = picked.split('|');
  const matchId = Number(matchIdStr);
  const resA = Number(resAStr);
  const resB = Number(resBStr);

  if (!interaction.guildId || !matchId || Number.isNaN(resA) || Number.isNaN(resB)) {
    return interaction.update({ content: '❌ Niepoprawne dane wyniku.', components: [] });
  }

  const pool = db.getPoolForGuild(interaction.guildId);

  // 1️⃣ upsert wyniku
  await pool.query(
    `
    INSERT INTO match_results (guild_id, match_id, res_a, res_b)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      res_a = VALUES(res_a),
      res_b = VALUES(res_b)
    `,
    [interaction.guildId, matchId, resA, resB]
  );

  // 2️⃣ usuń stare punkty
  await pool.query(
    `DELETE FROM match_points WHERE guild_id = ? AND match_id = ?`,
    [interaction.guildId, matchId]
  );

  // 3️⃣ pobierz predykcje
  const [preds] = await pool.query(
    `
    SELECT user_id, pred_a, pred_b, pred_exact_a, pred_exact_b
    FROM match_predictions
    WHERE guild_id = ? AND match_id = ?
    `,
    [interaction.guildId, matchId]
  );

  if (preds.length) {
    const values = preds.map(p => {
      const points = computeTotalPoints({
        predA: Number(p.pred_a),
        predB: Number(p.pred_b),
        resA,
        resB,
        predExactA: p.pred_exact_a ?? null,
        predExactB: p.pred_exact_b ?? null,
        exactA: null,
        exactB: null
      });
      return [interaction.guildId, matchId, p.user_id, points];
    });

    await pool.query(
      `
      INSERT INTO match_points (guild_id, match_id, user_id, points)
      VALUES ?
      `,
      [values]
    );
  }

  logger.info('matches', 'Match result set', {
    guildId: interaction.guildId,
    matchId,
    resA,
    resB,
    by: interaction.user.id
  });

  return interaction.update({
    content: `✅ Ustawiono wynik meczu **#${matchId}**: **${resA}:${resB}**\nPunkty zostały przeliczone.`,
    components: []
  });
};
