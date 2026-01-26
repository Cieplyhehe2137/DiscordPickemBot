// commands/ranking.js
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');

const PHASES = [
  { value: 'global',        label: 'Łączny (Global)' },
  { value: 'swiss_all',     label: 'Swiss – suma 3 etapów' },
  { value: 'swiss_stage_1', label: 'Swiss – Etap 1' },
  { value: 'swiss_stage_2', label: 'Swiss – Etap 2' },
  { value: 'swiss_stage_3', label: 'Swiss – Etap 3' },
  { value: 'playoffs',      label: 'Playoffs' },
  { value: 'doubleelim',    label: 'Double Elimination' },
  { value: 'playin',        label: 'Play-In' },
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

/* =========================
   SQL BUILDERS (GUILD SAFE)
========================= */
function totalsSqlForPhase(phase) {
  if (phase === 'global') {
    return `
      SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS total_points
      FROM (
        SELECT user_id, displayname, points FROM swiss_scores      WHERE guild_id = ?
        UNION ALL
        SELECT user_id, displayname, points FROM playoffs_scores   WHERE guild_id = ?
        UNION ALL
        SELECT user_id, displayname, points FROM doubleelim_scores WHERE guild_id = ?
        UNION ALL
        SELECT user_id, displayname, points FROM playin_scores     WHERE guild_id = ?
      ) t
      GROUP BY user_id
    `;
  }

  if (phase === 'swiss_all') {
    return `
      SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS total_points
      FROM swiss_scores
      WHERE guild_id = ?
      GROUP BY user_id
    `;
  }

  if (phase.startsWith('swiss_stage_')) {
    return `
      SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS total_points
      FROM swiss_scores
      WHERE guild_id = ? AND stage = ?
      GROUP BY user_id
    `;
  }

  return `
    SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS total_points
    FROM ${phase}_scores
    WHERE guild_id = ?
    GROUP BY user_id
  `;
}

async function countParticipants(pool, guildId, phase) {
  if (phase === 'global') {
    const [r] = await pool.query(
      `
      SELECT COUNT(DISTINCT user_id) AS cnt FROM (
        SELECT user_id FROM swiss_scores      WHERE guild_id = ?
        UNION
        SELECT user_id FROM playoffs_scores   WHERE guild_id = ?
        UNION
        SELECT user_id FROM doubleelim_scores WHERE guild_id = ?
        UNION
        SELECT user_id FROM playin_scores     WHERE guild_id = ?
      ) u
      `,
      [guildId, guildId, guildId, guildId]
    );
    return r[0]?.cnt || 0;
  }

  if (phase.startsWith('swiss_stage_')) {
    const stage = SWISS_STAGE_MAP[phase];
    const [r] = await pool.query(
      `SELECT COUNT(DISTINCT user_id) AS cnt FROM swiss_scores WHERE guild_id = ? AND stage = ?`,
      [guildId, stage]
    );
    return r[0]?.cnt || 0;
  }

  if (phase === 'swiss_all') {
    const [r] = await pool.query(
      `SELECT COUNT(DISTINCT user_id) AS cnt FROM swiss_scores WHERE guild_id = ?`,
      [guildId]
    );
    return r[0]?.cnt || 0;
  }

  const [r] = await pool.query(
    `SELECT COUNT(DISTINCT user_id) AS cnt FROM ${phase}_scores WHERE guild_id = ?`,
    [guildId]
  );
  return r[0]?.cnt || 0;
}

async function getPage(pool, guildId, phase, page, pageSize, userId) {
  const offset = (page - 1) * pageSize;
  const sql = totalsSqlForPhase(phase);

  let params;
  if (phase === 'global') {
    params = [guildId, guildId, guildId, guildId, pageSize, offset];
  } else if (phase.startsWith('swiss_stage_')) {
    params = [guildId, SWISS_STAGE_MAP[phase], pageSize, offset];
  } else {
    params = [guildId, pageSize, offset];
  }

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

/* =========================
   COMMAND
========================= */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Pokaż ranking Pick’Em z wyborem fazy i paginacją')
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
      return interaction.reply({ content: 'Ta komenda działa tylko na serwerze.', ephemeral: true });
    }

    await interaction.deferReply();

    return withGuild(guildId, async ({ pool }) => {
      const phase = interaction.options.getString('faza') || 'global';
      const pageSize = clampInt(
        interaction.options.getInteger('rozmiar_strony') || DEFAULT_PAGE_SIZE,
        1,
        MAX_PAGE_SIZE
      );

      const total = await countParticipants(pool, guildId, phase);
      if (!total) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Ranking Pick’Em')
              .setDescription('Brak danych dla tej fazy.')
              .setColor(0x5865F2)
          ]
        });
      }

      const page = 1;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const rows = await getPage(pool, guildId, phase, page, pageSize);

      const embed = new EmbedBuilder()
        .setTitle(`Ranking Pick’Em — ${phaseLabel(phase)}`)
        .setDescription(
          rows.map((r, i) =>
            `#${i + 1} **${r.displayname}** — \`${r.points} pkt\``
          ).join('\n')
        )
        .setFooter({ text: `Strona ${page}/${totalPages} • Uczestników: ${total}` })
        .setColor(0x5865F2);

      return interaction.editReply({ embeds: [embed] });
    });
  },
};
