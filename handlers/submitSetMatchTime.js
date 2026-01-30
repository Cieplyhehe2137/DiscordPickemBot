const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');
const { parseStartInputToUtc, formatStartLocal } = require('../utils/matchLock');

module.exports = async function submitSetMatchTime(interaction) {
  const [, matchId] = interaction.customId.split(':');

  if (!matchId) {
    return interaction.reply({
      content: '❌ Brak ID meczu.',
      ephemeral: true
    });
  }

  const timeRaw = interaction.fields.getTextInputValue('match_time');

  const { ok, utc, cleared, reason } = parseStartInputToUtc(timeRaw);
  if (!ok) {
    return interaction.reply({
      content: `❌ ${reason}`,
      ephemeral: true
    });
  }

  await withGuild(interaction, async ({ pool, guildId }) => {
    await pool.query(
      `
  UPDATE matches
  SET start_time_utc = ?
  WHERE id = ? AND guild_id = ?
  `,
      [
        utc ? utc.toFormat('yyyy-MM-dd HH:mm:ss') : null,
        matchId,
        guildId
      ]
    );

  });

  logger.info('matches', 'start_time_utc updated', {
    guildId: interaction.guildId,
    matchId,
    start_time_utc: utc ? utc.toISO() : null
  });

  return interaction.reply({
    content: cleared
      ? '🕒 Godzina meczu wyczyszczona.'
      : `🕒 Godzina meczu ustawiona na **${formatStartLocal(utc)} (PL)**`,
    ephemeral: true
  });
};
