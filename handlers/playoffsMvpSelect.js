const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');

module.exports = async function playoffsMvpSelect(interaction) {

  try {

    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('playoffs_mvp:')) return;

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const username =
      interaction.member?.displayName ||
      interaction.user?.globalName ||
      interaction.user?.username ||
      'Unknown';

    const selectedCandidateId = interaction.values?.[0];

    const eventId = interaction.customId.split(':')[1];

    if (!guildId || !eventId || !selectedCandidateId) {

      return interaction.deferUpdate();

    }

    await withGuild({ guildId }, async ({ pool }) => {

      await pool.query(`
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
        eventId,
        userId,
        username,
        selectedCandidateId
      ]);

    });

    // brak wiadomości dla usera
    // dropdown po prostu się zapisuje

    await interaction.deferUpdate();

  }
  catch (err) {

    logger.error('mvp', 'playoffsMvpSelect failed', {

      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack

    });

    return interaction.deferUpdate();

  }

};