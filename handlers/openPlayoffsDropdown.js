const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../db');

async function loadTeamsFromDB(guildId) {
  const [rows] = await pool.query(
    `SELECT name
     FROM teams
     WHERE guild_id = ?
       AND active = 1
     ORDER BY name ASC`,
    [guildId]
  );
  return rows.map(r => r.name);
}

module.exports = async (interaction) => {
  const guildId = interaction.guildId;

  const teams = await loadTeamsFromDB(guildId);

  if (!teams.length) {
    return interaction.reply({
      content: '❌ Brak aktywnych drużyn w bazie danych.',
      ephemeral: true
    });
  }

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