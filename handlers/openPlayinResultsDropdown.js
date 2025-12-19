const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const teams = require('../teams.json');

module.exports = async (interaction) => {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  
//   logger.info(`[Play-in Results] ${username} (${userId}) otwiera panel oficjalnych wyników Play-In`); 
  
  try {

    const embed = new EmbedBuilder()
      .setTitle('📌 Oficjalne wyniki – Play-In')
      .setDescription('Wybierz **8 drużyn**, które awansowały z fazy Play-In.\n\nPo wyborze kliknij Zatwierdź, aby zapisać.')
      .setColor('#32CD32');

    const select = new StringSelectMenuBuilder()
      .setCustomId('official_playin_teams')
      .setPlaceholder('Wybierz 8 drużyn awansujących')
      .setMinValues(8)
      .setMaxValues(8)
      .addOptions(
        teams.map(team => ({
          label: team,
          value: team
        }))
      );

    const row = new ActionRowBuilder().addComponents(select);

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_playin_results')
      .setLabel('✅ Zatwierdź wyniki')
      .setStyle(ButtonStyle.Success);

    const buttonRow = new ActionRowBuilder().addComponents(confirmButton);

    await interaction.reply({
      embeds: [embed],
      components: [row, buttonRow],
      ephemeral: true
    });
  } catch (err) {
    logger.error(`[Play-in Results] Błąd przy otwieraniu dropdowna Play-In dla ${username} (${userId}):`, err);
    await interaction.reply({
      content: '❌ Wystąpił błąd podczas generowania dropdowna Play-In.',
      ephemeral: true
    });
  }
};