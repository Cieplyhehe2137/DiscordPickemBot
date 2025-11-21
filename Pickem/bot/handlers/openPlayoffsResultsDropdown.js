const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs'); // ✅ dodaj to
const path = require('path'); // ✅ i to też

const teamsPath = path.join(__dirname, '../teams.json');
const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

module.exports = async (interaction) => {
  const options = teams.map(team => ({
    label: team,
    value: team
  }));

  const embed = new EmbedBuilder()
    .setTitle('🛠️ Ustaw oficjalne wyniki fazy Playoffs')
    .setDescription('Wybierz oficjalne drużyny dla każdej kategorii.');

  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('results_playoffs_semifinalists')
        .setPlaceholder('🏆 Wybierz 4 półfinalistów')
        .setMinValues(4)
        .setMaxValues(4)
        .addOptions(options)
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('results_playoffs_finalists')
        .setPlaceholder('🥈 Wybierz 2 finalistów')
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(options)
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('results_playoffs_winner')
        .setPlaceholder('👑 Wybierz zwycięzcę')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(options)
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('results_playoffs_third_place_winner')
        .setPlaceholder('🥉 Wybierz 3. miejsce (opcjonalnie)')
        .setMinValues(0)
        .setMaxValues(1)
        .addOptions(options)
    )
  ];

  const confirm = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_playoffs_results')
      .setLabel('✅ Zatwierdź wyniki')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({
    embeds: [embed],
    components: [...rows, confirm],
    ephemeral: true
  });
};
