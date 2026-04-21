const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');

module.exports = async function adminMvpResultSelect(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('admin_mvp_result_select:')) return;

    const guildId = interaction.guildId;
    const eventId = interaction.customId.split(':')[1];
    const candidateId = interaction.values?.[0];

    if (!guildId || !eventId || !candidateId) {
      return interaction.reply({
        content: '❌ Brak danych do zapisania MVP.',
        ephemeral: true
      });
    }

    await withGuild({ guildId }, async ({ pool }) => {

      await pool.query(
        `
          INSERT INTO mvp_results (
            guild_id,
            event_id,
            candidate_id
          )
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            candidate_id = VALUES(candidate_id),
            updated_at = CURRENT_TIMESTAMP
        `,
        [guildId, eventId, candidateId]
      );

      await interaction.reply({
        content:
          '🏆 Oficjalny MVP zapisany.\n' +
          'Po przeliczeniu punktów użytkownicy dostaną **+5 pkt** za trafienie.',
        ephemeral: true
      });

    });

  } catch (err) {
    logger.error('mvp', 'adminMvpResultSelect failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.reply({
      content: '❌ Nie udało się zapisać MVP.',
      ephemeral: true
    }).catch(() => {});
  }
};