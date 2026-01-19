const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const pool = require('../db');

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  // Pobranie drużyn z właściwej tabeli
  const [rows] = await pool.query(
    `SELECT team_name
     FROM teams
     WHERE guild_id = ?
     ORDER BY team_name ASC`,
    [guildId]
  );

  const teamNames = rows.map(r => r.team_name).filter(Boolean);

  if (teamNames.length === 0) {
    return interaction.editReply({
      content: 'Brak drużyn w bazie dla tego serwera. Dodaj je najpierw.'
    });
  }

  if (teamNames.length > 25) {
    return interaction.editReply({
      content: `Masz ${teamNames.length} drużyn, a dropdown może mieć maks. 25. Musimy zrobić stronicowanie.`
    });
  }

  const embed = new EmbedBuilder()
    .setColor('#00b0f4')
    .setTitle('📌 Pick\'Em – Play-In')
    .setDescription('Wybierz 8 drużyn, które Twoim zdaniem awansują z fazy Play-In.');

  const selectCustomId = `playin_qualified:${guildId}:${userId}`;
  const confirmCustomId = `confirm_playin:${guildId}:${userId}`;

  const dropdown = new StringSelectMenuBuilder()
    .setCustomId(selectCustomId)
    .setPlaceholder('Wybierz 8 drużyn awansujących')
    .setMinValues(8)
    .setMaxValues(8)
    .addOptions(teamNames.map(team => ({ label: team, value: team })));

  const row = new ActionRowBuilder().addComponents(dropdown);

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmCustomId)
      .setLabel('✅ Zatwierdź typy')
      .setStyle(ButtonStyle.Success)
  );

  return interaction.editReply({
    embeds: [embed],
    components: [row, confirmRow]
  });
};
