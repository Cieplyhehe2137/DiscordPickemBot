const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = async (interaction) => {
  try {
    const stage = interaction.customId.split('_').pop(); // np. stage1, stage2, stage3
    const teams = JSON.parse(fs.readFileSync('./teams.json', 'utf8'));

    const embed = new EmbedBuilder()
      .setTitle(`📋 Typowanie – SWISS (${stage.toUpperCase()})`)
      .setDescription('Wybierz swoje typy w dropdownach poniżej i kliknij **Zatwierdź typy**.')
      .setColor('#0099ff');

    const dropdowns = [
      new StringSelectMenuBuilder()
        .setCustomId(`swiss_3_0_${stage}`)
        .setPlaceholder('🔥 Wybierz 2 drużyny 3-0')
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(teams.map(team => ({
          label: team,
          value: team
        }))),

      new StringSelectMenuBuilder()
        .setCustomId(`swiss_0_3_${stage}`)
        .setPlaceholder('💀 Wybierz 2 drużyny 0-3')
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(teams.map(team => ({
          label: team,
          value: team
        }))),

      new StringSelectMenuBuilder()
        .setCustomId(`swiss_advancing_${stage}`)
        .setPlaceholder('🚀 Wybierz 6 drużyn awansujących')
        .setMinValues(6)
        .setMaxValues(6)
        .addOptions(teams.map(team => ({
          label: team,
          value: team
        })))
    ];

    const rows = dropdowns.map(menu => new ActionRowBuilder().addComponents(menu));

    const confirmButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_${stage}`)
        .setLabel('✅ Zatwierdź typy')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      content: `🔽 Wybierz swoje typy SWISS (${stage.toUpperCase()})`,
      embeds: [embed],
      components: [...rows, confirmButton],
      ephemeral: true
    });
  } catch (err) {
    console.error('❌ Błąd w openSwissDropdown:', err);
    await interaction.reply({ content: '❌ Wystąpił błąd podczas generowania dropdownów.', ephemeral: true });
  }
};