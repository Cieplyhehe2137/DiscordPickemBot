// handlers/teamsAddOpen.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits
} = require('discord.js');

module.exports = async function teamsAddOpen(interaction) {
  // tylko serwer
  if (!interaction.guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

  // tylko admin
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '⛔ Tylko administracja.',
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('teams:add:submit') // spójne, czytelne ID
    .setTitle('➕ Dodaj drużynę');

  const nameInput = new TextInputBuilder()
    .setCustomId('team_name')
    .setLabel('Nazwa drużyny')
    .setPlaceholder('np. Natus Vincere')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const shortInput = new TextInputBuilder()
    .setCustomId('team_short')
    .setLabel('Skrót (opcjonalnie)')
    .setPlaceholder('np. NAVI')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(30);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(shortInput)
  );

  return interaction.showModal(modal);
};
