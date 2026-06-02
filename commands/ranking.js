const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { withGuild } = require('../utils/guildContext');

const PHASES = [
  { value: 'global', label: 'Łączny (Global)' },
  { value: 'swiss_all', label: 'Swiss – suma 3 etapów' },
  { value: 'swiss_stage_1', label: 'Swiss – Etap 1' },
  { value: 'swiss_stage_2', label: 'Swiss – Etap 2' },
  { value: 'swiss_stage_3', label: 'Swiss – Etap 3' },
  { value: 'playoffs', label: 'Playoffs' },
  { value: 'doubleelim', label: 'Double Elimination' },
  { value: 'playin', label: 'Play-In' },
  { value: 'matches', label: 'Mecze' },
  { value: 'mvp', label: 'MVP' },
];

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 25;

const SWISS_STAGE_MAP = {
  swiss_stage_1: 'stage1',
  swiss_stage_2: 'stage2',
  swiss_stage_3: 'stage3',
};

const phaseLabel = (phase) =>
  PHASES.find(p => p.value === phase)?.label || 'Łączny (Global)';

const clampInt = (n, min, max) =>
  Math.min(max, Math.max(min, parseInt(n, 10) || min));

async function getCurrentEventId(pool, guildId) {
  const [active] = await pool.query(
    `
    SELECT id
    FROM events
    WHERE guild_id = ?
      AND status = 'active'
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId]
  );

  if (active[0]?.id) return active[0].id;

  const [latest] = await pool.query(
    `
    SELECT id
    FROM events
    WHERE guild_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId]
  );

  return latest[0]?.id || null;
}

function totalsSqlForPhase(phase) {
  if (phase === 'global') {
    return `
      SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS total_points
      FROM (
        SELECT
          CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
          CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS displayname,
          points
        FROM swiss_scores
        WHERE guild_id = ? AND event_id = ?

        UNION ALL

        SELECT
          CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
          CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS displayname,
          points
        FROM playoffs_scores
        WHERE guild_id = ? AND event_id = ?

        UNION ALL

        SELECT
          CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
          CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS displayname,
          points
        FROM doubleelim_scores
        WHERE guild_id = ? AND event_id = ?

        UNION ALL

        SELECT
          CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
          CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS displayname,
          points
        FROM playin_scores
        WHERE guild_id = ? AND event_id = ?

        UNION ALL

        SELECT
          CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
          CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS displayname,
          points
        FROM match_points
        WHERE guild_id = ? AND event_id = ?

        UNION ALL

        SELECT
          CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
          CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS displayname,
          points
        FROM mvp_scores
        WHERE guild_id = ? AND event_id = ?
      ) t
      GROUP BY user_id
    `;
  }

  if (phase === 'swiss_all') {
    return `
      SELECT
        CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
        MAX(CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS displayname,
        SUM(points) AS total_points
      FROM swiss_scores
      WHERE guild_id = ? AND event_id = ?
      GROUP BY user_id
    `;
  }

  if (phase.startsWith('swiss_stage_')) {
    return `
      SELECT
        CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
        MAX(CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS displayname,
        SUM(points) AS total_points
      FROM swiss_scores
      WHERE guild_id = ? AND event_id = ? AND stage = ?
      GROUP BY user_id
    `;
  }

  if (phase === 'matches') {
    return `
      SELECT
        CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
        CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS displayname,
        SUM(points) AS total_points
      FROM match_points
      WHERE guild_id = ? AND event_id = ?
      GROUP BY user_id
    `;
  }

  if (phase === 'mvp') {
    return `
      SELECT
        CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
        CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS displayname,
        SUM(points) AS total_points
      FROM mvp_scores
      WHERE guild_id = ? AND event_id = ?
      GROUP BY user_id
    `;
  }

  return `
    SELECT
      CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
      MAX(CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS displayname,
      SUM(points) AS total_points
    FROM ${phase}_scores
    WHERE guild_id = ? AND event_id = ?
    GROUP BY user_id
  `;
}

function getParamsForPhase(guildId, eventId, phase, pageSize = null, offset = null) {
  let params;

  if (phase === 'global') {
    params = [
      guildId, eventId,
      guildId, eventId,
      guildId, eventId,
      guildId, eventId,
      guildId, eventId,
      guildId, eventId,
    ];
  } else if (phase.startsWith('swiss_stage_')) {
    params = [guildId, eventId, SWISS_STAGE_MAP[phase]];
  } else {
    params = [guildId, eventId];
  }

  if (pageSize !== null && offset !== null) {
    params.push(pageSize, offset);
  }

  return params;
}

async function countParticipants(pool, guildId, eventId, phase) {
  const sql = totalsSqlForPhase(phase);
  const params = getParamsForPhase(guildId, eventId, phase);

  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS cnt
    FROM (${sql}) t
    `,
    params
  );

  return Number(rows[0]?.cnt || 0);
}

async function getPage(pool, guildId, eventId, phase, page, pageSize) {
  const offset = (page - 1) * pageSize;
  const sql = totalsSqlForPhase(phase);
  const params = getParamsForPhase(guildId, eventId, phase, pageSize, offset);

  const [rows] = await pool.query(
    `
    SELECT user_id, displayname, total_points
    FROM (${sql}) t
    ORDER BY total_points DESC, displayname ASC
    LIMIT ? OFFSET ?
    `,
    params
  );

  return rows.map(r => ({
    user_id: r.user_id,
    displayname: r.displayname || r.user_id,
    points: Number(r.total_points || 0),
  }));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Pokaż ranking Pick’Em z wyborem fazy')
    .addStringOption(opt =>
      opt.setName('faza')
        .setDescription('Wybierz fazę rankingu')
        .addChoices(...PHASES.map(p => ({ name: p.label, value: p.value })))
    )
    .addIntegerOption(opt =>
      opt.setName('rozmiar_strony')
        .setDescription(`Ile osób na stronę (1–${MAX_PAGE_SIZE})`)
        .setMinValue(1)
        .setMaxValue(MAX_PAGE_SIZE)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: 'Ta komenda działa tylko na serwerze.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    return withGuild(guildId, async ({ pool }) => {
      const phase = interaction.options.getString('faza') || 'global';
      const pageSize = clampInt(
        interaction.options.getInteger('rozmiar_strony') || DEFAULT_PAGE_SIZE,
        1,
        MAX_PAGE_SIZE
      );

      const eventId = await getCurrentEventId(pool, guildId);

      if (!eventId) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Ranking Pick’Em')
              .setDescription('Brak aktywnego lub istniejącego eventu dla tego serwera.')
              .setColor(0x5865F2)
          ]
        });
      }

      const total = await countParticipants(pool, guildId, eventId, phase);

      if (!total) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Ranking Pick’Em — ${phaseLabel(phase)}`)
              .setDescription(`Brak danych dla tej fazy w evencie ID: \`${eventId}\`.`)
              .setColor(0x5865F2)
          ]
        });
      }

      const page = 1;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const rows = await getPage(pool, guildId, eventId, phase, page, pageSize);

      const embed = new EmbedBuilder()
        .setTitle(`Ranking Pick’Em — ${phaseLabel(phase)}`)
        .setDescription(
          rows.map((r, i) =>
            `#${i + 1} <@${r.user_id}> — \`${r.points} pkt\``
          ).join('\n')
        )
        .setFooter({
          text: `Event ID: ${eventId} • Strona ${page}/${totalPages} • Uczestników: ${total}`
        })
        .setColor(0x5865F2);

      return interaction.editReply({ embeds: [embed] });
    });
  },
};