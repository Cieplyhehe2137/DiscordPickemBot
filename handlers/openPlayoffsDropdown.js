const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');

async function loadTeamsFromDB(pool, guildId) {
  const [rows] = await pool.query(`
    SELECT name
    FROM teams
    WHERE guild_id = ?
    AND active = 1
    ORDER BY sort_order ASC, name ASC
  `, [guildId]);

  return rows.map(r => r.name).filter(Boolean);
}

async function loadMvpCandidates(pool, guildId, eventId) {
  const [rows] = await pool.query(`
    SELECT id, nickname, team_name
    FROM mvp_candidates
    WHERE guild_id = ?
    AND event_id = ?
    AND is_active = 1
    ORDER BY nickname ASC
  `, [guildId, eventId]);

  return rows;
}

async function getLatestEventId(pool, guildId) {
  const [rows] = await pool.query(`
    SELECT id
    FROM events
    WHERE guild_id = ?
    ORDER BY id DESC
    LIMIT 1
  `, [guildId]);

  return rows[0]?.id || null;
}

module.exports = async function openPlayoffsDropdown(interaction) {
  console.log('🔥 OPEN PLAYOFFS DROPDOWN WITH MVP + CONFIRM MESSAGE');

  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Brak guildId.',
        ephemeral: true
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const eventId = await getLatestEventId(pool, guildId);

      console.log('EVENT DEBUG', {
        guildId,
        eventId
      });

      if (!eventId) {
        return interaction.editReply({
          content: '❌ Nie znaleziono eventu.'
        });
      }

      const teams = await loadTeamsFromDB(pool, guildId);

      console.log('TEAMS DEBUG', {
        count: teams.length
      });

      if (!teams.length) {
        return interaction.editReply({
          content: '❌ Brak drużyn w bazie.'
        });
      }

      const mvpCandidates = await loadMvpCandidates(pool, guildId, eventId);

      console.log('MVP DEBUG', {
        count: mvpCandidates.length,
        candidates: mvpCandidates
      });

      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle("📌 Pick'Em – Playoffs")
        .setDescription(
          'Wybierz drużyny dla fazy play-off:\n\n' +
          '🏅 4 półfinalistów\n' +
          '🥈 2 finalistów\n' +
          '🥇 1 zwycięzcę\n' +
          '🥉 (opcjonalnie) 1 drużynę na 3. miejscu\n' +
          (mvpCandidates.length ? '⭐ 1 MVP turnieju\n' : '')
        );

      const makeOptions = () =>
        teams.map(t => ({
          label: t,
          value: t
        }));

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

      const components = [row1, row2, row3, row4];

      if (mvpCandidates.length) {
        if (mvpCandidates.length > 25) {
          return interaction.editReply({
            content:
              `⚠️ Kandydatów MVP jest ${mvpCandidates.length}, a Discord pozwala max 25 opcji.\n` +
              `Trzeba dodać paginację MVP.`
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
                label: c.team_name
                  ? `${c.nickname} (${c.team_name})`
                  : c.nickname,
                value: String(c.id)
              }))
            )
        );

        components.push(row5);
      }

      await interaction.editReply({
        embeds: [embed],
        components
      });

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_playoffs')
          .setLabel('✅ Zatwierdź typy')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.followUp({
        content: 'Gdy skończysz wybierać wszystkie typy, kliknij poniżej:',
        components: [confirmRow],
        ephemeral: true
      });
    });
  } catch (err) {
    logger.error('playoffs', 'openPlayoffsDropdown failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.editReply({
      content: '❌ Błąd otwierania Pick\'Em Playoffs.'
    }).catch(() => {});
  }
};