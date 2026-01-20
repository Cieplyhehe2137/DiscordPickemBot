const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const pool = require('../db');

// ⬇️ pobieramy drużyny z BAZY, nie z JSON
async function loadTeamsFromDB(guildId) {
  const [rows] = await pool.query(
    `SELECT name FROM teams WHERE active = 1 ORDER BY name ASC`
  );
  return rows.map(r => r.name);
}

module.exports = async (interaction) => {
  // ⛔ NIE sprawdzamy isButton()
  if (interaction.customId !== 'open_results_playoffs') return;

  const guildId = interaction.guildId;
  const teams = await loadTeamsFromDB(guildId);

  if (!teams.length) {
    return interaction.followUp({
      content: '❌ Brak aktywnych drużyn w bazie.',
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 Ustaw wyniki Playoffs')
    .setDescription(
      'Możesz **dodawać drużyny partiami** – dokładnie jak w Swiss.\n' +
      'Dropdowny zapisują stan w bazie.'
    )
    .setColor('#ffcc00');

  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('results_playoffs_semifinalists')
        .setPlaceholder('Półfinaliści (max 4)')
        .setMinValues(0)
        .setMaxValues(4)
        .addOptions(teams.map(t => ({ label: t, value: t })))
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('results_playoffs_finalists')
        .setPlaceholder('Finaliści (max 2)')
        .setMinValues(0)
        .setMaxValues(2)
        .addOptions(teams.map(t => ({ label: t, value: t })))
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('results_playoffs_winner')
        .setPlaceholder('Zwycięzca')
        .setMinValues(0)
        .setMaxValues(1)
        .addOptions(teams.map(t => ({ label: t, value: t })))
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('results_playoffs_third_place_winner')
        .setPlaceholder('3. miejsce (opcjonalnie)')
        .setMinValues(0)
        .setMaxValues(1)
        .addOptions(teams.map(t => ({ label: t, value: t })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_playoffs_results')
        .setLabel('✅ Zatwierdź')
        .setStyle(ButtonStyle.Success)
    )
  ];

  return interaction.followUp({
    embeds: [embed],
    components: rows,
    ephemeral: true
  });
};
