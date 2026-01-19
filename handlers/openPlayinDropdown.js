const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const db = require('../db');

module.exports = async (interaction) => {
  const guildId = interaction.guildId;

  // Zawsze ephemeral
  await interaction.deferReply({ ephemeral: true });

  // Pobierz drużyny z DB
  const pool = db.getPoolForGuild(guildId);
  const [rows] = await pool.query(
    `SELECT name
     FROM teams
     WHERE guild_id = ?
       AND active = 1
     ORDER BY sort_order ASC, name ASC`,
    [guildId]
  );

  const teamNames = rows.map(r => r.name);

  if (teamNames.length === 0) {
    return interaction.editReply({
      content: '❌ Brak aktywnych drużyn w bazie. Dodaj je w panelu admina.'
    });
  }

  if (teamNames.length > 25) {
    return interaction.editReply({
      content: `⚠️ Masz ${teamNames.length} drużyn, a Discord pozwala max 25 opcji w jednym dropdownie. Trzeba zrobić stronicowanie.`
    });
  }

  // Embed
  const embed = new EmbedBuilder()
    .setColor('#00b0f4')
    .setTitle('📌 Pick\'Em – Play-In')
    .setDescription('Wybierz **8 drużyn**, które Twoim zdaniem **awansują z fazy Play-In**.');

  // UWAGA: customId bez parametrów – router tego wymaga
  const dropdown = new StringSelectMenuBuilder()
    .setCustomId('playin_select')
    .setPlaceholder('Wybierz 8 drużyn')
    .setMinValues(8)
    .setMaxValues(8)
    .addOptions(teamNames.map(team => ({ label: team, value: team })));

  const rowSelect = new ActionRowBuilder().addComponents(dropdown);

  const rowConfirm = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_playin')
      .setLabel('✅ Zatwierdź typy')
      .setStyle(ButtonStyle.Success)
  );

  return interaction.editReply({
    embeds: [embed],
    components: [rowSelect, rowConfirm]
  });
};
