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
      return interaction.reply({
        content: '❌ Brak wymaganych danych do zapisania typu MVP.',
        ephemeral: true
      });
    }

    await withGuild({ guildId }, async ({ pool, guildId }) => {
      const [candidateRows] = await pool.query(
        `
          SELECT id, nickname, team_name
          FROM mvp_candidates
          WHERE guild_id = ? AND event_id = ? AND id = ? AND is_active = 1
          LIMIT 1
        `,
        [guildId, eventId, selectedCandidateId]
      );

      if (!candidateRows.length) {
        throw new Error('Wybrany kandydat MVP nie istnieje lub nie jest aktywny.');
      }

      await pool.query(
        `
          INSERT INTO mvp_predictions (
            guild_id, event_id, user_id, username, candidate_id
          )
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            username = VALUES(username),
            candidate_id = VALUES(candidate_id),
            updated_at = CURRENT_TIMESTAMP
        `,
        [guildId, eventId, userId, username, selectedCandidateId]
      );

      const candidate = candidateRows[0];

      await interaction.reply({
        content:
          `✅ Zapisano Twój typ MVP: **${candidate.nickname}**` +
          `${candidate.team_name ? ` (${candidate.team_name})` : ''}\n` +
          'Trafienie oficjalnego MVP = **+5 pkt**.',
        ephemeral: true
      });
    });
  } catch (err) {
    logger.error('mvp', 'playoffsMvpSelect failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.reply({
      content: '❌ Nie udało się zapisać typu MVP.',
      ephemeral: true
    }).catch(() => {});
  }
};