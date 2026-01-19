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

  // Zawsze ephemeral w tym widoku
  await interaction.deferReply({ ephemeral: true });

  // Pobierz drużyny z tabeli teams (POPRAWIONE KOLUMNY)
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
      content: 'Brak aktywnych drużyn w bazie dla tego serwera. Dodaj je najpierw w panelu admina.'
    });
  }

  if (teamNames.length > 25) {
    return interaction.editReply({
      content: `Masz ${teamNames.length} drużyn, a Discord pozwala tylko na 25 opcji w jednym dropdownie. Musimy zrobić stronicowanie.`
    });
  }

  // Embed
  const embed = new EmbedBuilder()
    .setColor('#00b0f4')
    .setTitle('📌 Pick\'Em – Play-In')
    .setDescription('Wybierz 8 drużyn, które Twoim zdaniem awansują z fazy Play-In.');

  // CustomId zabezpieczony userID
  const selectCustomId = `playin_qualified:${guildId}:${userId}`;
  const confirmCustomId = `confirm_playin:${guildId}:${userId}`;

  // Dropdown
  const dropdown = new StringSelectMenuBuilder()
    .setCustomId(selectCustomId)
    .setPlaceholder('Wybierz 8 drużyn awansujących')
    .setMinValues(8)
    .setMaxValues(8)
    .addOptions(
      teamNames.map(team => ({
        label: team,
        value: team
      }))
    );

  const row = new ActionRowBuilder().addComponents(dropdown);

  // Przycisk zatwierdzenia
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmCustomId)
      .setLabel('✅ Zatwierdź typy')
      .setStyle(ButtonStyle.Success)
  );

  // Wyślij UI do użytkownika
  return interaction.editReply({
    embeds: [embed],
    components: [row, confirmRow]
  });
};
