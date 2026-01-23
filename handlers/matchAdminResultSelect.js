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

  if (
    !interaction.guildId ||
    !Number.isInteger(matchId) ||
    !Number.isInteger(resA) ||
    !Number.isInteger(resB)
  ) {
    return interaction.update({
      content: '❌ Niepoprawne dane wyniku.',
      components: []
    });
  }

  const pool = db.getPoolForGuild(interaction.guildId);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 🔒 0️⃣ sprawdź, czy mecz należy do tej guildy
    const [[match]] = await conn.query(
      `SELECT id FROM matches WHERE id = ? AND guild_id = ? LIMIT 1`,
      [matchId, interaction.guildId]
    );

    if (!match) {
      await conn.rollback();
      return interaction.update({
        content: '❌ Ten mecz nie istnieje lub nie należy do tego serwera.',
        components: []
      });
    }

    // 1️⃣ upsert wyniku serii
    await conn.query(
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
    await conn.query(
      `DELETE FROM match_points WHERE guild_id = ? AND match_id = ?`,
      [interaction.guildId, matchId]
    );

    // 3️⃣ pobierz predykcje
    const [preds] = await conn.query(
      `
      SELECT user_id, pred_a, pred_b, pred_exact_a, pred_exact_b
      FROM match_predictions
      WHERE guild_id = ? AND match_id = ?
      `,
      [interaction.guildId, matchId]
    );

    // 4️⃣ policz i zapisz punkty
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

      await conn.query(
        `
        INSERT INTO match_points (guild_id, match_id, user_id, points)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          points = VALUES(points),
          computed_at = CURRENT_TIMESTAMP
        `,
        [values]
      );
    }

    await conn.commit();

    logger.info('matches', 'Match result set', {
      guild_id: interaction.guildId,
      matchId,
      resA,
      resB,
      by: interaction.user.id
    });

    return interaction.update({
      content:
        `✅ Ustawiono wynik meczu **#${matchId}**: **${resA}:${resB}**\n` +
        `📊 Punkty zostały przeliczone.`,
      components: []
    });

  } catch (err) {
    try { await conn.rollback(); } catch (_) {}

    logger.error('matches', 'matchAdminResultSelect failed', {
      guild_id: interaction.guildId,
      matchId,
      message: err.message,
      stack: err.stack
    });

    return interaction.update({
      content: '❌ Błąd podczas zapisu wyniku meczu.',
      components: []
    });
  } finally {
    conn.release();
  }
};
