const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = async function openMvpCandidatesModal(interaction, eventId) {
  if (!eventId) {
    return interaction.reply({
      content: '❌ Brak event_id dla modala MVP.',
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`mvp_admin_candidates_modal:${eventId}`)
    .setTitle('Ustaw kandydatów MVP');

  const input = new TextInputBuilder()
    .setCustomId('mvp_candidates_input')
    .setLabel('Każda linia: nickname|team')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('donk|Spirit\nm0NESY|G2\nZywOo|Vitality')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(input)
  );

  return interaction.showModal(modal);
};