const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');

async function resolveActiveEventId(pool, guildId) {
  const [[eventRow]] = await pool.query(
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

  return eventRow?.id || null;
}

module.exports = async function openMvpCandidatesModalEntry(interaction) {
  await withGuild(interaction, async ({ pool, guildId }) => {
    const eventId = await resolveActiveEventId(pool, guildId);

    if (!eventId) {
      return interaction.reply({
        content: '❌ Nie znaleziono aktywnego eventu.',
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`mvp_admin_candidates_modal:${eventId}`)
      .setTitle('Ustaw kandydatów MVP');

    const candidatesInput = new TextInputBuilder()
      .setCustomId('mvp_candidates_input')
      .setLabel('Każda linia: nickname|team')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('donk|Spirit\nm0NESY|G2\nZywOo|Vitality')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(candidatesInput)
    );

    return interaction.showModal(modal);
  });
};