const { logInfo, logError } = require('../../utils/logger');
const { withGuild } = require('../../utils/guildContext');
const recalculateMatchPoints = require('../../services/recalculateMatchPoints');

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
        const [[match]] = await pool.query(
          `
          SELECT id, event_id, best_of
          FROM matches
          WHERE id = ?
            AND guild_id = ?
          LIMIT 1
          `,
          [matchId, guildId]
        );

        if (!match) {
          await pool.query('ROLLBACK');
          return interaction.update({
            content: '❌ Ten mecz nie istnieje lub nie należy do tego serwera.',
            components: []
          });
        }

        const eventId = match.event_id;

        if (!eventId) {
          await pool.query('ROLLBACK');
          return interaction.update({
            content: '❌ Ten mecz nie ma przypisanego event_id.',
            components: []
          });
        }

        await pool.query(
          `
          INSERT INTO match_results
            (guild_id, event_id, match_id, res_a, res_b)
          VALUES
            (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            event_id = VALUES(event_id),
            res_a = VALUES(res_a),
            res_b = VALUES(res_b)
          `,
          [guildId, eventId, matchId, resA, resB]
        );

        await recalculateMatchPoints(
          pool,
          guildId,
          eventId,
          matchId,
          match.best_of
        );

        await pool.query('COMMIT');

        logInfo('matches', 'Match result set', {
          guildId,
          eventId,
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
    logError('matches', 'matchAdminResultSelect failed', {
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