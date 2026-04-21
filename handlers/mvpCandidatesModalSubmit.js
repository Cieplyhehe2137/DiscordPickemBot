const { withGuild } = require('../utils/guildContext');

function parseMvpCandidates(raw) {
  return String(raw)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [nickname, team_name] = line.split('|').map(v => v?.trim() || null);
      return {
        nickname,
        team_name: team_name || null
      };
    })
    .filter(x => x.nickname);
}

module.exports = async function mvpCandidatesModalSubmit(interaction) {
  try {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('mvp_admin_candidates_modal:')) return;

    const guildId = interaction.guildId;
    const eventId = interaction.customId.split(':')[1];
    const raw = interaction.fields.getTextInputValue('mvp_candidates_input');

    const candidates = parseMvpCandidates(raw);

    if (!candidates.length) {
      return interaction.reply({
        content: '❌ Nie podano żadnych poprawnych kandydatów MVP.',
        ephemeral: true
      });
    }

    await withGuild({ guildId }, async ({ pool, guildId }) => {
      await pool.query(
        `
          UPDATE mvp_candidates
          SET is_active = 0
          WHERE guild_id = ? AND event_id = ?
        `,
        [guildId, eventId]
      );

      for (const c of candidates) {
        await pool.query(
          `
            INSERT INTO mvp_candidates (
              guild_id, event_id, nickname, team_name, is_active
            )
            VALUES (?, ?, ?, ?, 1)
          `,
          [guildId, eventId, c.nickname, c.team_name]
        );
      }
    });

    return interaction.reply({
      content:
        `✅ Zapisano kandydatów MVP dla eventu **${eventId}**.\n` +
        candidates.map(c => `• ${c.nickname}${c.team_name ? ` (${c.team_name})` : ''}`).join('\n'),
      ephemeral: true
    });
  } catch (err) {
    console.error('mvpCandidatesModalSubmit failed:', err);
    return interaction.reply({
      content: '❌ Nie udało się zapisać kandydatów MVP.',
      ephemeral: true
    });
  }
};