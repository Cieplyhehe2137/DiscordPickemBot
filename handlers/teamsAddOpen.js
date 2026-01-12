// handlers/teamsAddOpen.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits
} = require('discord.js');

module.exports = async function teamsAddOpen(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('teams:add_modal')
    .setTitle('Dodaj drużynę');

  const nameInput = new TextInputBuilder()
    .setCustomId('team_name')
    .setLabel('Nazwa drużyny')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const shortInput = new TextInputBuilder()
    .setCustomId('team_short')
    .setLabel('Skrót (opcjonalnie)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(30);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(shortInput)
  );

  return interaction.showModal(modal);
};
