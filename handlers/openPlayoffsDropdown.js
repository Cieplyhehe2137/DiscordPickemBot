const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = async (interaction) => {
  const teams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'teams.json'), 'utf8'));

  const embed = new EmbedBuilder()
    .setColor('#f1c40f')
    .setTitle("📌 Pick'Em – Playoffs")
    .setDescription('Wybierz drużyny dla fazy play-off:\n\n🏅 **4 półfinalistów**\n🥈 **2 finalistów**\n🥇 **1 zwycięzcę**\n🥉 *(opcjonalnie)* **1 drużynę na 3. miejscu**');

  const row1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('playoffs_semifinalists').setPlaceholder('Wybierz 4 półfinalistów').setMinValues(4).setMaxValues(4)
      .addOptions(teams.map(t => ({ label: t, value: t })))
  );
  const row2 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('playoffs_finalists').setPlaceholder('Wybierz 2 finalistów').setMinValues(2).setMaxValues(2)
      .addOptions(teams.map(t => ({ label: t, value: t })))
  );
  const row3 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('playoffs_winner').setPlaceholder('Wybierz zwycięzcę').setMinValues(1).setMaxValues(1)
      .addOptions(teams.map(t => ({ label: t, value: t })))
  );
  const row4 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('playoffs_third_place').setPlaceholder('(Opcjonalnie) Wybierz 3. miejsce').setMinValues(0).setMaxValues(1)
      .addOptions(teams.map(t => ({ label: t, value: t })))
  );
  const row5 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('confirm_playoffs').setLabel('✅ Zatwierdź typy').setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4, row5], ephemeral: true });
};