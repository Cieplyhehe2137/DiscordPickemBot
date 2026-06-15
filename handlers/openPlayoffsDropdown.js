const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');
const { logInfo, logWarn, logError } = require('../utils/logger');

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

async function loadMvpCandidates(pool, guildId) {
  const [rows] = await pool.query(`
    SELECT id, nickname, team_name
    FROM mvp_candidates
    WHERE guild_id = ?
    AND is_active = 1
    ORDER BY nickname ASC
  `, [guildId]);

  return rows;
}

module.exports = async function openPlayoffsDropdown(interaction) {
  // console.log('🔥 OPEN PLAYOFFS DROPDOWN WITH MVP + CONFIRM MESSAGE');

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

      const teams = await loadTeamsFromDB(pool, guildId);

      if (!teams.length) {
        return interaction.editReply({
          content: '❌ Brak drużyn w bazie.'
        });
      }

      const mvpCandidates = await loadMvpCandidates(pool, guildId);

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
        const mvpPage = 0;
        const totalMvpPages = Math.ceil(mvpCandidates.length / MVP_PAGE_SIZE);

        const mvpCandidatesPage = mvpCandidates.slice(
          mvpPage * MVP_PAGE_SIZE,
          (mvpPage + 1) * MVP_PAGE_SIZE
        );

        const row5 = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`playoffs_mvp_page_${mvpPage}`)
            .setPlaceholder(`⭐ Wybierz MVP turnieju (${mvpPage + 1}/${totalMvpPages})`)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
              mvpCandidatesPage.map(c => ({
                label: c.team_name
                  ? `${c.nickname} (${c.team_name})`
                  : c.nickname,
                value: String(c.id)
              }))
            )
        );

        components.push(row5);

        if (totalMvpPages > 1) {
          const mvpPaginationRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`playoffs_mvp_prev_${mvpPage}`)
              .setLabel('◀ MVP')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),

            new ButtonBuilder()
              .setCustomId(`playoffs_mvp_next_${mvpPage}`)
              .setLabel('MVP ▶')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(false)
          );

          components.push(mvpPaginationRow);
        }
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
    logError('playoffs', 'openPlayoffsDropdown failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.editReply({
      content: '❌ Błąd otwierania Pick\'Em Playoffs.'
    }).catch(() => { });
  }
};