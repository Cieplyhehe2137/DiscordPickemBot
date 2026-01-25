const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');
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

  try {
    await withGuild(interaction, async ({ pool, guildId }) => {
      await pool.query('START TRANSACTION');

      try {
        // 🔒 0️⃣ sprawdź, czy mecz należy do tej guildy
        const [[match]] = await pool.query(
          `SELECT id FROM matches WHERE id = ? AND guild_id = ? LIMIT 1`,
          [matchId, guildId]
        );

        if (!match) {
          await pool.query('ROLLBACK');
          return interaction.update({
            content: '❌ Ten mecz nie istnieje lub nie należy do tego serwera.',
            components: []
          });
        }

        // 1️⃣ upsert wyniku serii
        await pool.query(
          `
          INSERT INTO match_results (guild_id, match_id, res_a, res_b)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            res_a = VALUES(res_a),
            res_b = VALUES(res_b)
          `,
          [guildId, matchId, resA, resB]
        );

        // 2️⃣ usuń stare punkty
        await pool.query(
          `DELETE FROM match_points WHERE guild_id = ? AND match_id = ?`,
          [guildId, matchId]
        );

        // 3️⃣ pobierz predykcje
        const [preds] = await pool.query(
          `
          SELECT user_id, pred_a, pred_b, pred_exact_a, pred_exact_b
          FROM match_predictions
          WHERE guild_id = ? AND match_id = ?
          `,
          [guildId, matchId]
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
            return [guildId, matchId, p.user_id, points];
          });

          await pool.query(
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

        await pool.query('COMMIT');

        logger.info('matches', 'Match result set', {
          guildId,
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
        await pool.query('ROLLBACK');
        throw err;
      }
    });

  } catch (err) {
    logger.error('matches', 'matchAdminResultSelect failed', {
      guildId: interaction.guildId,
      matchId,
      message: err.message,
      stack: err.stack
    });

    return interaction.update({
      content: '❌ Błąd podczas zapisu wyniku meczu.',
      components: []
    });
  }
};
