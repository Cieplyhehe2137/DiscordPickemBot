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

  // Ephemeral odpowiedź (jeśli to kliknięcie buttona, reply jest OK; update już nie używamy)
  // Jak chcesz mieć pewność, że nie przekroczysz limitu czasu, możesz deferować:
  await interaction.deferReply({ ephemeral: true });

  // 1) Pobierz drużyny z bazy po guildId
  // DOSTOSUJ: nazwa tabeli/kolumn do Twojej bazy
  const [rows] = await pool.query(
    `SELECT team_name
     FROM guild_teams
     WHERE guild_id = ?
       AND (active = 1 OR active IS NULL)
     ORDER BY team_name ASC`,
    [guildId]
  );

  const teamNames = rows.map(r => r.team_name).filter(Boolean);

  if (teamNames.length === 0) {
    return interaction.editReply({
      content: 'Nie mam żadnych drużyn w bazie dla tego serwera. Dodaj je najpierw w panelu admina / komendą.'
    });
  }

  // Discord select menu ma limit 25 opcji
  if (teamNames.length > 25) {
    return interaction.editReply({
      content: `Masz ${teamNames.length} drużyn w bazie, a dropdown może mieć max 25 opcji. Trzeba to rozwiązać np. stronicowaniem albo filtrem.`
    });
  }

  // 2) UI (ephemeral)
  const embed = new EmbedBuilder()
    .setColor('#00b0f4')
    .setTitle('📌 Pick\'Em – Play-In')
    .setDescription('Wybierz 8 drużyn, które Twoim zdaniem awansują z fazy Play-In.');

  // Dobrze dać customId z userId, żeby ktoś inny nie próbował klikać w cudze ephemeral flow
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
