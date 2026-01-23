const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const db = require('../db');
const logger = require('../utils/logger');

async function loadTeamsFromDB(guildId) {
  const pool = db.getPoolForGuild(guildId);
  const [rows] = await pool.query(
    `
    SELECT name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY sort_order ASC, name ASC
    `,
    [guildId]
  );
  return rows.map(r => r.name);
}

module.exports = async (interaction) => {
  const guildId = interaction.guildId;

  try {
    await interaction.deferReply({ ephemeral: true });

    const teams = await loadTeamsFromDB(guildId);

    if (!teams.length) {
      return interaction.editReply({
        content: '❌ Brak aktywnych drużyn w bazie danych.'
      });
    }

    if (teams.length > 25) {
      return interaction.editReply({
        content:
          `⚠️ Jest **${teams.length} drużyn**, a Discord pozwala max **25 opcji** w jednym dropdownie.\n` +
          `Trzeba dodać stronicowanie (jak w meczach).`
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle("📌 Pick'Em – Playoffs")
      .setDescription(
        'Wybierz drużyny dla fazy play-off:\n\n' +
        '🏅 **4 półfinalistów**\n' +
        '🥈 **2 finalistów**\n' +
        '🥇 **1 zwycięzcę**\n' +
        '🥉 *(opcjonalnie)* **1 drużynę na 3. miejscu**'
      );

    const makeOptions = () => teams.map(t => ({ label: t, value: t }));

    const row1 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('playoffs_semifinalists')
        .setPlaceholder('Wybierz 4 półfinalistów')
        .setMinValues(4)
        .setMaxValues(4)
        .addOptions(makeOptions())
    );

    const row2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('playoffs_finalists')
        .setPlaceholder('Wybierz 2 finalistów')
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(makeOptions())
    );

    const row3 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('playoffs_winner')
        .setPlaceholder('Wybierz zwycięzcę')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(makeOptions())
    );

    const row4 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('playoffs_third_place')
        .setPlaceholder('(Opcjonalnie) Wybierz 3. miejsce')
        .setMinValues(0)
        .setMaxValues(1)
        .addOptions(makeOptions())
    );

    const row5 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_playoffs')
        .setLabel('✅ Zatwierdź typy')
        .setStyle(ButtonStyle.Success)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2, row3, row4, row5]
    });

  } catch (err) {
    logger.error('playoffs', 'open playoffs pick failed', {
      guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.editReply({
      content: '❌ Wystąpił błąd podczas otwierania Pick’Em Playoffs.'
    }).catch(() => {});
  }
};
