const { 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder 
} = require('discord.js');
const fs = require('fs');

module.exports = async (interaction) => {
  try {
    const stage = interaction.customId.split('_').pop(); // np. stage1, stage2, stage3

    const teams = JSON.parse(fs.readFileSync('./teams.json', 'utf8'));
    const flags = JSON.parse(fs.readFileSync('./data/teamFlags.json', 'utf8'));

    // 🔥 jedna drużyna pod drugą z flagą
    const teamList = teams
      .map(t => `${flags[t] || ''} ${t}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`📋 Typowanie – SWISS (${stage.toUpperCase()})`)
      .setDescription('Wybierz swoje typy w dropdownach poniżej i kliknij **Zatwierdź typy**.')
      .addFields({
        name: '📌 Dostępne drużyny:',
        value: teamList
      })
      .setColor('#0099ff');

    // 🔥 dropdowny z flagami
    const buildOptions = () =>
      teams.map(team => ({
        label: `${flags[team] || ''} ${team}`,
        value: team
      }));

    const dropdowns = [
      new StringSelectMenuBuilder()
        .setCustomId(`swiss_3_0_${stage}`)
        .setPlaceholder('🔥 Wybierz 2 drużyny 3-0')
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(buildOptions()),

      new StringSelectMenuBuilder()
        .setCustomId(`swiss_0_3_${stage}`)
        .setPlaceholder('💀 Wybierz 2 drużyny 0-3')
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(buildOptions()),

      new StringSelectMenuBuilder()
        .setCustomId(`swiss_advancing_${stage}`)
        .setPlaceholder('🚀 Wybierz 6 drużyn 3-1 lub 3-2')
        .setMinValues(6)
        .setMaxValues(6)
        .addOptions(buildOptions())
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
