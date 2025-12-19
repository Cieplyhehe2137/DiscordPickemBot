const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = async (interaction) => {
  try {
    const selectStage = new StringSelectMenuBuilder()
      .setCustomId('admin_select_swiss_stage')
      .setPlaceholder('📌 Wybierz etap Swiss do ustawienia wyników')
      .addOptions([
        {
          label: 'Swiss Stage 1',
          value: 'stage1'
        },
        {
          label: 'Swiss Stage 2',
          value: 'stage2'
        },
        {
          label: 'Swiss Stage 3',
          value: 'stage3'
        }
      ]);

    const row = new ActionRowBuilder().addComponents(selectStage);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📁 Wybierz etap Swiss')
      .setDescription('Wybierz, dla której fazy Swiss chcesz ustawić oficjalne wyniki turnieju.');

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  } catch (err) {
    console.error('❌ Błąd w handleSelectSwissResultsStage:', err);
    await interaction.reply({ content: '❌ Nie udało się otworzyć menu wyboru etapu Swiss.', ephemeral: true });
  }
};
