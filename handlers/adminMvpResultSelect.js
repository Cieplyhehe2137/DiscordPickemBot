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
    const candidateId = Number(interaction.values?.[0]);

    if (!guildId || !Number.isInteger(candidateId) || candidateId <= 0) {
      return interaction.reply({
        content: '❌ Nieprawidłowy kandydat MVP.',
        ephemeral: true
      }).catch(() => { });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const [[event]] = await pool.query(
        `
  SELECT id
  FROM events
  WHERE guild_id = ?
    AND is_active = 1
    AND is_archived = 0
  ORDER BY id DESC
  LIMIT 1
  `,
        [guildId]
      );

      if (!event?.id) {
        throw new Error('No active event found for MVP result');
      }

      await pool.query(
        `
        INSERT INTO mvp_results (
          guild_id,
          event_id,
          candidate_id,
          active
        )
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          candidate_id = VALUES(candidate_id),
          active = 1,
          updated_at = CURRENT_TIMESTAMP
        `,
        [guildId, event.id, candidateId]
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

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        content: '❌ Nie udało się zapisać oficjalnego MVP.',
        ephemeral: true
      }).catch(() => { });
    }

    return interaction.reply({
      content: '❌ Nie udało się zapisać oficjalnego MVP.',
      ephemeral: true
    }).catch(() => { });
  }
};