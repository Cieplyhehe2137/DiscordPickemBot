const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');

module.exports = async function submitSetMatchTime(interaction) {
  const [, matchId] = interaction.customId.split(':');

  if (!matchId) {
    return interaction.reply({
      content: '❌ Brak ID meczu.',
      ephemeral: true
    });
  }

  const timeRaw = interaction.fields.getTextInputValue('match_time');

  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(timeRaw)) {
    return interaction.reply({
      content: '❌ Zły format. Użyj: YYYY-MM-DD HH:MM',
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
      [timeRaw, matchId, guildId]
    );
  });

  logger.info('matches', 'start_time_utc updated', {
    guildId: interaction.guildId,
    matchId,
    start_time_utc: timeRaw
  });

  return interaction.reply({
    content: `🕒 Godzina meczu ustawiona na **${timeRaw} (UTC)**`,
    ephemeral: true
  });
};
