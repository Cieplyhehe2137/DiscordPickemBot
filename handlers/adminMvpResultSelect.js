const { withGuild } = require('../utils/guildContext');
const { logError } = require('../utils/logger');

module.exports = async function adminMvpResultSelect(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;

    if (
      interaction.customId !== 'admin_mvp_result_select' &&
      interaction.customId !== 'mvp_result_select'
    ) {
      return;
    }

    const guildId = interaction.guildId;
    const candidateId = interaction.values?.[0];

    if (!guildId || !candidateId) {
      return interaction.deferUpdate();
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      await pool.query(
        `
        INSERT INTO mvp_results (
          guild_id,
          candidate_id,
          active
        )
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE
          candidate_id = VALUES(candidate_id),
          active = 1,
          updated_at = CURRENT_TIMESTAMP
        `,
        [guildId, candidateId]
      );
    });

    return interaction.update({
      content: '✅ Oficjalny MVP został zapisany.',
      embeds: [],
      components: []
    });
  } catch (err) {
    logError('mvp', 'adminMvpResultSelect failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.reply({
      content: '❌ Nie udało się zapisać oficjalnego MVP.',
      ephemeral: true
    }).catch(() => {});
  }
};