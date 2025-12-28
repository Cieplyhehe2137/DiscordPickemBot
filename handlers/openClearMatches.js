// handlers/openClearMatches.js
const { ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = async function openClearMatches(interaction) {
  if (!hasAdminPerms(interaction)) {
    return interaction.reply({ content: '❌ Brak uprawnień (Administrator / Zarządzanie serwerem).', ephemeral: true });
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('match_clear_phase_select')
      .setPlaceholder('Wybierz fazę…')
      .addOptions([
        { label: 'Swiss — Stage 1', value: 'swiss_stage1' },
        { label: 'Swiss — Stage 2', value: 'swiss_stage2' },
        { label: 'Swiss — Stage 3', value: 'swiss_stage3' },
        { label: 'Playoffs', value: 'playoffs' },
        { label: 'Double Elim', value: 'doubleelim' },
        { label: 'Play-In', value: 'playin' },
      ])
  );

  return interaction.reply({
    content: '🧹 Wybierz fazę, z której chcesz **usunąć wszystkie mecze (MATCHES)** wraz z wynikami i punktami dla meczów:',
    components: [row],
    ephemeral: true
  });
};
