const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');
const { withGuild } = require('../utils/guildContext');

const FIRST_PAGE_MATCHES = 24;
const NEXT_PAGE_MATCHES = 23;

function mapPanelValueToDbPhase(raw) {
  const map = {
    swiss_stage1: 'swiss_stage1',
    swiss_stage2: 'swiss_stage2',
    swiss_stage3: 'swiss_stage3',
    playoffs: 'playoffs',
    double_elimination: 'double_elimination',
    playin: 'playin',
  };

  return map[raw] || raw;
}

function getPhaseDisplayName(raw) {
  const map = {
    swiss_stage1: 'Swiss Stage 1',
    swiss_stage2: 'Swiss Stage 2',
    swiss_stage3: 'Swiss Stage 3',
    playoffs: 'Playoffs',
    double_elimination: 'Double Elimination',
    playin: 'Play-In',
  };

  return map[raw] || raw;
}

async function resolveLatestEventId(pool, phase, guildId) {
  const [rows] = await pool.query(
    `
    SELECT event_id
    FROM matches
    WHERE guild_id = ?
      AND phase = ?
      AND event_id IS NOT NULL
    ORDER BY event_id DESC
    LIMIT 1
    `,
    [guildId, phase]
  );

  return rows?.[0]?.event_id ?? null;
}

function getPageData(matches, page) {
  const total = matches.length;

  if (page < 0) page = 0;

  let start;
  let pageMatchLimit;

  if (page === 0) {
    start = 0;
    pageMatchLimit = FIRST_PAGE_MATCHES;
  } else {
    start = FIRST_PAGE_MATCHES + (page - 1) * NEXT_PAGE_MATCHES;
    pageMatchLimit = NEXT_PAGE_MATCHES;
  }

  const end = Math.min(start + pageMatchLimit, total);
  const slice = matches.slice(start, end);

  const hasPrev = page > 0;
  const hasNext = end < total;

  let totalPages = 1;
  if (total > FIRST_PAGE_MATCHES) {
    totalPages =
      1 + Math.ceil((total - FIRST_PAGE_MATCHES) / NEXT_PAGE_MATCHES);
  }

  return {
    page,
    total,
    totalPages,
    start,
    end,
    slice,
    hasPrev,
    hasNext,
  };
}

function buildPagedMatchSelect({ matches, phase, eventId, page = 0 }) {
  const {
    total,
    totalPages,
    start,
    end,
    slice,
    hasPrev,
    hasNext,
  } = getPageData(matches, page);

  const options = [];

  for (const match of slice) {
    const teamA = match.team_a || 'TBD';
    const teamB = match.team_b || 'TBD';
    const bo = match.best_of ? `Bo${match.best_of}` : 'Bo?';

    let label = `#${match.match_no} ${teamA} vs ${teamB} (${bo})`;
    if (label.length > 100) {
      label = label.slice(0, 97) + '...';
    }

    let description = `Mecz #${match.match_no}`;
    if (match.is_locked) description += ' • zablokowany';
    if (description.length > 100) {
      description = description.slice(0, 97) + '...';
    }

    options.push({
      label,
      value: `match:${match.id}`,
      description,
    });
  }

  if (hasPrev) {
    options.push({
      label: '⬅️ Poprzednia strona',
      value: 'nav:prev',
      description: 'Pokaż wcześniejsze mecze',
    });
  }

  if (hasNext) {
    options.push({
      label: '➡️ Następna strona',
      value: 'nav:next',
      description: 'Pokaż kolejne mecze',
    });
  }

  const placeholderStart = total === 0 ? 0 : start + 1;
  const placeholderEnd = end;

  const select = new StringSelectMenuBuilder()
    .setCustomId(`match_select_page:${phase}:${eventId}:${page}`)
    .setPlaceholder(
      `Wybierz mecz... (${placeholderStart}-${placeholderEnd} z ${total}, strona ${page + 1}/${totalPages})`
    )
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'panel:select:match_phase') return;

  const raw = interaction.values?.[0];
  if (!raw) {
    if (!interaction.deferred && !interaction.replied) {
      return interaction.reply({
        content: '❌ Nie wybrano fazy.',
        ephemeral: true,
      });
    }

    return interaction.editReply({
      content: '❌ Nie wybrano fazy.',
      embeds: [],
      components: [],
    });
  }

  const dbPhase = mapPanelValueToDbPhase(raw);
  const phaseLabel = getPhaseDisplayName(raw);

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  try {
    await withGuild(interaction, async ({ pool, guildId }) => {
      const eventId = await resolveLatestEventId(pool, dbPhase, guildId);

      if (!eventId) {
        return interaction.editReply({
          content: `❌ Nie udało się ustalić eventu dla fazy **${phaseLabel}**.`,
          embeds: [],
          components: [],
        });
      }

      const [matches] = await pool.query(
        `
        SELECT
          id,
          event_id,
          guild_id,
          phase,
          match_no,
          team_a,
          team_b,
          best_of,
          is_locked
        FROM matches
        WHERE event_id = ?
          AND guild_id = ?
          AND phase = ?
        ORDER BY match_no ASC, id ASC
        `,
        [eventId, guildId, dbPhase]
      );

      if (!matches || matches.length === 0) {
        return interaction.editReply({
          content: `ℹ️ Brak meczów do typowania dla fazy **${phaseLabel}**.`,
          embeds: [],
          components: [],
        });
      }

      const row = buildPagedMatchSelect({
        matches,
        phase: dbPhase,
        eventId,
        page: 0,
      });

      const embed = new EmbedBuilder()
        .setTitle('🎯 Wybierz mecz do wytypowania wyniku')
        .setDescription(
          [
            `**Faza:** ${phaseLabel}`,
            `**Liczba meczów:** ${matches.length}`,
            '',
            `Na pierwszej stronie jest do 24 meczów + „Następna strona”.`,
            `Na kolejnych stronach pojawia się też „Poprzednia strona”.`,
          ].join('\n')
        );

      return interaction.editReply({
        content: null,
        embeds: [embed],
        components: [row],
      });
    });
  } catch (err) {
    console.error('[matchPredictionPhaseSelect] failed:', err);

    return interaction.editReply({
      content: `❌ Nie udało się wczytać meczów.\n\`${err.message}\``,
      embeds: [],
      components: [],
    });
  }
};