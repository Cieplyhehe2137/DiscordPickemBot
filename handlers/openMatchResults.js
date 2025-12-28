// handlers/openMatchResults.js
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = async function openMatchResults(interaction) {
  // Admin panel -> wybór fazy
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('match_admin_phase_select')
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
    content: '📄 Wybierz fazę, dla której chcesz **wprowadzić oficjalne wyniki meczów**:',
    components: [row],
    ephemeral: true
  });
};
