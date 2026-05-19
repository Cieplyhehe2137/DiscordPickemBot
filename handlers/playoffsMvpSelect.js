const { withGuild } = require('../utils/guildContext');
const { logError } = require('../utils/logger');

module.exports = async function playoffsMvpSelect(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'playoffs_mvp') return;

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const username =
      interaction.member?.displayName ||
      interaction.user?.globalName ||
      interaction.user?.username ||
      'Unknown';

    const selectedCandidateId = interaction.values?.[0];

    if (!guildId || !selectedCandidateId) {
      return interaction.deferUpdate();
    }

    await withGuild(interaction, async ({ pool }) => {
      await pool.query(
        `
        INSERT INTO mvp_predictions (
          guild_id,
          user_id,
          username,
          candidate_id
        )
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          username = VALUES(username),
          candidate_id = VALUES(candidate_id),
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          guildId,
          userId,
          username,
          selectedCandidateId
        ]
      );
    });

    await interaction.deferUpdate();
  } catch (err) {
    logError('mvp', 'playoffsMvpSelect failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.deferUpdate().catch(() => {});
  }
};