// handlers/teamsImportOpen.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits
} = require('discord.js');

module.exports = async function teamsImportOpen(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('teams:import_modal')
    .setTitle('Import drużyn (JSON)');

  const input = new TextInputBuilder()
    .setCustomId('teams_json')
    .setLabel('Wklej JSON: np. ["FaZe","NAVI","G2"]')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
};
