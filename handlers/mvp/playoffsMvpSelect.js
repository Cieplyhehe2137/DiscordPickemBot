const { withGuild } = require('../../utils/guildContext');
const { logError } = require('../../utils/logger');

module.exports = async function playoffsMvpSelect(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('playoffs_mvp_page_')) return;

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const username =
      interaction.member?.displayName ||
      interaction.user?.globalName ||
      interaction.user?.username ||
      'Unknown';

    const selectedCandidateId = interaction.values?.[0];

    if (!guildId || !selectedCandidateId) {
      return interaction.deferUpdate().catch(() => {});
    }

    await withGuild(interaction, async ({ pool }) => {
      const [[event]] = await pool.query(
        `
        SELECT id
        FROM events
        WHERE guild_id = ?
          AND status = 'OPEN'
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId]
      );

      if (!event?.id) {
        throw new Error('No OPEN event found for MVP prediction');
      }

      await pool.query(
        `
        INSERT INTO mvp_predictions (
          guild_id,
          event_id,
          user_id,
          username,
          candidate_id
        )
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          username = VALUES(username),
          candidate_id = VALUES(candidate_id),
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          guildId,
          event.id,
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