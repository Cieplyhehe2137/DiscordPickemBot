// handlers/teamsDeleteConfirmOpen.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const teamsState = require('../utils/teamsState');

module.exports = async function teamsDeleteConfirmOpen(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
  }

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const st = teamsState.get(guildId, userId);
  if (!st?.selectedTeamId) {
    return interaction.reply({ content: '⚠️ Najpierw wybierz drużynę z listy.', ephemeral: true });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('teams:delete_yes')
      .setLabel('✅ Usuń')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('teams:delete_no')
      .setLabel('❌ Anuluj')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content: `⚠️ Na pewno chcesz usunąć drużynę o ID **${st.selectedTeamId}**?`,
    components: [row],
    ephemeral: true
  });
};
