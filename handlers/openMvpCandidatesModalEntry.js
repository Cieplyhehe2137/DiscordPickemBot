const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = async function openMvpCandidatesModalEntry(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('mvp:candidates:modal')
    .setTitle('Ustaw kandydatów MVP');

  const candidatesInput = new TextInputBuilder()
    .setCustomId('mvp_candidates')
    .setLabel('Kandydaci MVP')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('np. ZywOo, m0NESY, donk')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(candidatesInput)
  );

  return interaction.showModal(modal);
};