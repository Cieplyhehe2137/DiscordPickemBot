// handlers/openAddMatch.js
const { ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = async function openAddMatch(interaction) {
  const response = {
    content: '➕ **Dodawanie meczu** — wybierz fazę:',
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('match_add_phase_select')
          .setPlaceholder('Wybierz fazę…')
          .addOptions([
            { label: 'Swiss — Stage 1', value: 'swiss_stage1' },
            { label: 'Swiss — Stage 2', value: 'swiss_stage2' },
            { label: 'Swiss — Stage 3', value: 'swiss_stage3' },
            { label: 'Playoffs', value: 'playoffs' },
            { label: 'Double Elim', value: 'doubleelim' },
            { label: 'Play-In', value: 'playin' },
          ])
      )
    ]
  };

  if (!hasAdminPerms(interaction)) {
    const err = { content: '❌ Brak uprawnień (Administrator / Zarządzanie serwerem).' };

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(err);
    }
    return interaction.reply({ ...err, ephemeral: true });
  }

  // 🔑 KLUCZOWY FRAGMENT
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  }

  return interaction.reply({ ...response, ephemeral: true });
};
