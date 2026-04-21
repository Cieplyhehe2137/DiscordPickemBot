const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');
const getActiveOrLatestEventId = require('../utils/getActiveOrLatestEventId');

async function loadTeamsFromDB(pool, guildId) {
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
  return rows.map(r => r.name).filter(Boolean);
}

async function loadMvpCandidatesFromDB(pool, guildId, eventId) {
  const [rows] = await pool.query(
    `
    SELECT id, nickname, team_name
    FROM mvp_candidates
    WHERE guild_id = ?
      AND event_id = ?
      AND is_active = 1
    ORDER BY nickname ASC
    `,
    [guildId, eventId]
  );

  return rows;
}

module.exports = async (interaction) => {
  if (!interaction.guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const eventId = await getActiveOrLatestEventId(guildId);

      if (!eventId) {
        return interaction.editReply({
          content: '❌ Nie udało się ustalić aktywnego eventu.'
        });
      }

      const teams = await loadTeamsFromDB(pool, guildId);

      if (!teams.length) {
        return interaction.editReply({
          content: '❌ Brak aktywnych drużyn w bazie danych.'
        });
      }

      if (teams.length > 25) {
        return interaction.editReply({
          content:
            `⚠️ Jest **${teams.length} drużyn**, a Discord pozwala max **25 opcji** w jednym dropdownie.\n` +
            `➡️ Trzeba dodać stronicowanie (jak w meczach).`
        });
      }

      const mvpCandidates = await loadMvpCandidatesFromDB(pool, guildId, eventId);

      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle("📌 Pick'Em – Playoffs")
        .setDescription(
          'Wybierz drużyny dla fazy play-off:\n\n' +
          '🏅 **4 półfinalistów**\n' +
          '🥈 **2 finalistów**\n' +
          '🥇 **1 zwycięzcę**\n' +
          '🥉 *(opcjonalnie)* **1 drużynę na 3. miejscu**\n' +
          (mvpCandidates.length ? '⭐ **1 MVP turnieju**\n' : '')
        );

      const makeTeamOptions = () => teams.map(t => ({ label: t, value: t }));

      const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('playoffs_semifinalists')
          .setPlaceholder('Wybierz 4 półfinalistów')
          .setMinValues(4)
          .setMaxValues(4)
          .addOptions(makeTeamOptions())
      );

      const row2 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('playoffs_finalists')
          .setPlaceholder('Wybierz 2 finalistów')
          .setMinValues(2)
          .setMaxValues(2)
          .addOptions(makeTeamOptions())
      );

      const row3 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('playoffs_winner')
          .setPlaceholder('Wybierz zwycięzcę')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(makeTeamOptions())
      );

      const row4 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('playoffs_third_place')
          .setPlaceholder('(Opcjonalnie) Wybierz 3. miejsce')
          .setMinValues(0)
          .setMaxValues(1)
          .addOptions(makeTeamOptions())
      );

      const components = [row1, row2, row3, row4];

      if (mvpCandidates.length) {
        if (mvpCandidates.length > 25) {
          return interaction.editReply({
            content:
              `⚠️ Jest **${mvpCandidates.length} kandydatów MVP**, a Discord pozwala max **25 opcji** w jednym dropdownie.\n` +
              `➡️ Trzeba dodać stronicowanie MVP.`
          });
        }

        const row5 = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`playoffs_mvp:${eventId}`)
            .setPlaceholder('⭐ Wybierz MVP turnieju')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
              mvpCandidates.map(c => ({
                label: c.team_name ? `${c.nickname} (${c.team_name})` : c.nickname,
                value: String(c.id)
              }))
            )
        );

        components.push(row5);
      }

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_playoffs')
          .setLabel('✅ Zatwierdź typy')
          .setStyle(ButtonStyle.Success)
      );

      components.push(confirmRow);

      return interaction.editReply({
        embeds: [embed],
        components
      });
    });

  } catch (err) {
    logger.error('playoffs', 'open playoffs pick failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.editReply({
      content: '❌ Wystąpił błąd podczas otwierania Pick’Em Playoffs.'
    }).catch(() => {});
  }
};