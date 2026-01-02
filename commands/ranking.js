// commands/ranking.js
const pool = require('../db');
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');

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

// ───────────────────────────────────────────────────────────────────────────────
// Helpers: etapy Swiss i mapowanie fazy → SQL
// ───────────────────────────────────────────────────────────────────────────────
const SWISS_STAGE_MAP = {
  swiss_stage_1: 'stage1',
  swiss_stage_2: 'stage2',
  swiss_stage_3: 'stage3',
};

function phaseLabel(phase) {
  return PHASES.find(p => p.value === phase)?.label || 'Łączny (Global)';
}
function clampInt(n, min, max) {
  return Math.min(max, Math.max(min, parseInt(n, 10) || min));
}

function isValidPhase(phase) {
  return PHASES.some(p => p.value === phase);
}

function requireValidPhase(phase) {
  if (!isValidPhase(phase)) {
    throw new Error(`Invalid phase: ${phase}`);
  }
  return phase;
}

// Zwraca SQL budujący zestaw "user_id, displayname, total_points" dla danej fazy
function totalsSqlForPhase(conn, phase) {
  requireValidPhase(phase);
  if (phase === 'global') {
    return `
      SELECT user_id, COALESCE(MAX(displayname), user_id) AS displayname, SUM(points) AS total_points
      FROM (
        SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points FROM swiss_scores      WHERE active=1 GROUP BY user_id
        UNION ALL
        SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points FROM playoffs_scores   WHERE active=1 GROUP BY user_id
        UNION ALL
        SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points FROM doubleelim_scores WHERE active=1 GROUP BY user_id
        UNION ALL
        SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points FROM playin_scores     WHERE active=1 GROUP BY user_id
      ) t
      GROUP BY user_id
    `;
  }
  if (phase === 'swiss_all') {
    return `
      SELECT user_id, COALESCE(MAX(displayname), user_id) AS displayname, SUM(points) AS total_points
      FROM swiss_scores
      WHERE active=1
      GROUP BY user_id
    `;
  }
  if (phase.startsWith('swiss_stage_')) {
    const stage = SWISS_STAGE_MAP[phase]; // 'stage1' | 'stage2' | 'stage3'
    return `
      SELECT user_id, COALESCE(MAX(displayname), user_id) AS displayname, SUM(points) AS total_points
      FROM swiss_scores
      WHERE active=1 AND stage=${conn.escape(stage)}
      GROUP BY user_id
    `;
  }
  // single-table fazy
  const table = `${phase}_scores`; // playoffs_scores | doubleelim_scores | playin_scores
  return `
    SELECT user_id, COALESCE(MAX(displayname), user_id) AS displayname, SUM(points) AS total_points
    FROM ${table}
    WHERE active=1
    GROUP BY user_id
  `;
}

// Liczba uczestników dla fazy
async function countParticipants(phase) {
  requireValidPhase(phase);
  const conn = pool;
  if (phase === 'global') {
    const [rows] = await conn.query(`
      SELECT COUNT(*) AS cnt FROM (
        SELECT user_id FROM swiss_scores      WHERE active=1 GROUP BY user_id
        UNION
        SELECT user_id FROM playoffs_scores   WHERE active=1 GROUP BY user_id
        UNION
        SELECT user_id FROM doubleelim_scores WHERE active=1 GROUP BY user_id
        UNION
        SELECT user_id FROM playin_scores     WHERE active=1 GROUP BY user_id
      ) u
    `);
    return rows[0]?.cnt || 0;
  }
  if (phase === 'swiss_all') {
    const [rows] = await conn.query(`SELECT COUNT(DISTINCT user_id) AS cnt FROM swiss_scores WHERE active=1`);
    return rows[0]?.cnt || 0;
  }
  if (phase.startsWith('swiss_stage_')) {
    const stage = SWISS_STAGE_MAP[phase];
    const [rows] = await conn.query(
      `SELECT COUNT(DISTINCT user_id) AS cnt FROM swiss_scores WHERE active=1 AND stage=?`,
      [stage]
    );
    return rows[0]?.cnt || 0;
  }
  const table = `${phase}_scores`;
  const [rows] = await conn.query(`SELECT COUNT(DISTINCT user_id) AS cnt FROM ${table} WHERE active=1`);
  return rows[0]?.cnt || 0;
}

// Pobranie strony rankingu + moja pozycja/punkty
async function getPage(phase, page, pageSize, requesterId) {
  requireValidPhase(phase);
  const offset = (page - 1) * pageSize;
  const conn = pool;

  const totalsSql = totalsSqlForPhase(conn, phase);
  const [res] = await conn.query(`
    SELECT user_id, displayname, total_points
    FROM (${totalsSql}) AS totals
    ORDER BY total_points DESC, displayname ASC
    LIMIT ? OFFSET ?
  `, [pageSize, offset]);

  const my = await getUserRankAndPoints(phase, requesterId);

  return {
    rows: res.map(r => ({
      user_id: r.user_id,
      displayname: r.displayname || r.user_id,
      points: Number(r.total_points || 0),
    })),
    myRank: my?.rank || null,
    myPoints: my?.points ?? null,
  };
}

// Pozycja użytkownika (bez CTE/okienek – kompatybilne)
async function getUserRank(phase, userId) {
  const conn = pool;
  const totalsSql = totalsSqlForPhase(conn, phase);
  const sql = `
    SELECT
      1 + (
        SELECT COUNT(*) FROM (${totalsSql}) t2
        WHERE t2.total_points > t1.total_points
      ) AS position
    FROM (${totalsSql}) t1
    WHERE t1.user_id = ${conn.escape(userId)}
  `;
  const [rows] = await conn.query(sql);
  return rows[0]?.position || null;
}

async function getUserRankAndPoints(phase, userId) {
  const conn = pool;
  const totalsSql = totalsSqlForPhase(conn, phase);
  const sql = `
    SELECT
      1 + (
        SELECT COUNT(*) FROM (${totalsSql}) t2
        WHERE t2.total_points > t1.total_points
      ) AS position,
      t1.total_points AS points
    FROM (${totalsSql}) t1
    WHERE t1.user_id = ${conn.escape(userId)}
  `;
  const [rows] = await conn.query(sql);
  return rows[0]
    ? { rank: rows[0].position || null, points: Number(rows[0].points || 0) }
    : null;
}

/* =======================
 *   EMBED & UI
 * ======================= */

function buildRankingEmbed(phase, rows, page, totalPages, totalCount, opts, pageSize = DEFAULT_PAGE_SIZE) {
  const { myRank, myPoints, requesterId } = opts || {};
  const title = `Ranking Pick’Em — ${phaseLabel(phase)}`;

  const description = rows.length
    ? rows.map((r, i) => {
        const absoluteRank = (page - 1) * pageSize + (i + 1);
        const isRequester = r.user_id === requesterId;
        const medal = absoluteRank === 1 ? '🥇'
                    : absoluteRank === 2 ? '🥈'
                    : absoluteRank === 3 ? '🥉'
                    : `#${absoluteRank}`;
        return `${medal} **${r.displayname}** — \`${r.points} pkt\`${isRequester ? '  ← **TY**' : ''}`;
      }).join('\n')
    : 'Brak danych.';

  const footerLines = [
    `Strona ${page}/${totalPages} • Uczestników: ${totalCount}`,
    myRank ? `Twoje miejsce: #${myRank}${typeof myPoints === 'number' ? ` (${myPoints} pkt)` : ''}`
           : 'Nie masz jeszcze punktów w tej fazie.',
  ];

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x5865F2)
    .setFooter({ text: footerLines.join(' • ') })
    .setTimestamp(new Date());
}

function buildNavRow(phase, page, totalPages, pageSize, disabledAll) {
  const prev = new ButtonBuilder()
    .setCustomId(`ranking:nav:${phase}:${page}:${pageSize}:prev`)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⬅️')
    .setDisabled(disabledAll || page <= 1);

  const me = new ButtonBuilder()
    .setCustomId(`ranking:nav:${phase}:${page}:${pageSize}:me`)
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🔎')
    .setLabel('Moja strona')
    .setDisabled(disabledAll);

  const stop = new ButtonBuilder()
    .setCustomId(`ranking:nav:${phase}:${page}:${pageSize}:stop`)
    .setStyle(ButtonStyle.Danger)
    .setEmoji('⏹️')
    .setDisabled(disabledAll);

  const next = new ButtonBuilder()
    .setCustomId(`ranking:nav:${phase}:${page}:${pageSize}:next`)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('➡️')
    .setDisabled(disabledAll || page >= totalPages);

  return new ActionRowBuilder().addComponents(prev, me, stop, next);
}

function buildPhaseSelectRow(currentPhase, page, pageSize) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`ranking:phase_select:${page}:${pageSize}`)
    .setPlaceholder('Wybierz fazę rankingu...')
    .addOptions(
      PHASES.map(p => ({
        label: p.label,
        value: p.value,
        default: p.value === currentPhase,
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

function disableAllComponents(rows) {
  try {
    const disabled = rows.map(row => {
      const newRow = ActionRowBuilder.from(row);
      newRow.components = newRow.components.map(comp => {
        const c = comp.toJSON();
        if (c.type === 2) return new ButtonBuilder(c).setDisabled(true);
        if (c.type === 3) return new StringSelectMenuBuilder(c).setDisabled(true);
        return comp;
      });
      return newRow;
    });
    return disabled;
  } catch {
    return rows;
  }
}

/* =======================
 *   SLASH & COMPONENTS
 * ======================= */

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

  // Slash
  async execute(interaction) {
    const chosenPhase = interaction.options.getString('faza') || 'global';
    const pageSize = interaction.options.getInteger('rozmiar_strony') || DEFAULT_PAGE_SIZE;

    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      const totalCount = await countParticipants(chosenPhase);

      if (totalCount === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle('Ranking Pick’Em')
          .setDescription('Brak danych do wyświetlenia dla wybranej fazy. 🤷')
          .setColor(0x5865F2)
          .setFooter({ text: phaseLabel(chosenPhase) });

        return interaction.editReply({
          embeds: [emptyEmbed],
          components: [
            buildPhaseSelectRow(chosenPhase, 1, pageSize),
            buildNavRow(chosenPhase, 1, 1, pageSize, true),
          ],
        });
      }

      let page = 1;
      const { rows, myRank, myPoints } = await getPage(chosenPhase, page, pageSize, userId);
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

      const embed = buildRankingEmbed(
        chosenPhase,
        rows,
        page,
        totalPages,
        totalCount,
        { myRank, myPoints, requesterId: userId },
        pageSize
      );

      const components = [
        buildPhaseSelectRow(chosenPhase, page, pageSize),
        buildNavRow(chosenPhase, page, totalPages, pageSize, false),
      ];

      return interaction.editReply({ embeds: [embed], components });
    } catch (err) {
      console.error('❌ /ranking error:', err);
      return interaction.editReply({ content: 'Wystąpił błąd podczas budowy rankingu. Spróbuj ponownie później.' });
    }
  },

  // Buttons & Select
  async handleComponent(interaction) {
    try {
      if (interaction.isButton() && interaction.customId.startsWith('ranking:nav:')) {
        await interaction.deferUpdate();
        const [, , phase, pageStr, pageSizeStr, dir] = interaction.customId.split(':');
        if (!isValidPhase(phase)) {
          return interaction.editReply({ content: 'Nieprawidłowa faza rankingu.', components: [] });
        }
        const pageSize = clampInt(+pageSizeStr || DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
        const totalCount = await countParticipants(phase);
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        let page = clampInt(+pageStr || 1, 1, totalPages);

        if (dir === 'prev') page = Math.max(1, page - 1);
        if (dir === 'next') page = Math.min(totalPages, page + 1);
        if (dir === 'me') {
          const myRank = await getUserRank(phase, interaction.user.id);
          if (myRank) page = clampInt(Math.ceil(myRank / pageSize), 1, totalPages);
        }
        if (dir === 'stop') {
          return interaction.editReply({ components: disableAllComponents(interaction.message.components) });
        }

        const userId = interaction.user.id;
        const { rows, myRank, myPoints } = await getPage(phase, page, pageSize, userId);
        const embed = buildRankingEmbed(
          phase,
          rows,
          page,
          totalPages,
          totalCount,
          { myRank, myPoints, requesterId: userId },
          pageSize
        );

        const components = [
          buildPhaseSelectRow(phase, page, pageSize),
          buildNavRow(phase, page, totalPages, pageSize, false),
        ];
        return interaction.editReply({ embeds: [embed], components });
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ranking:phase_select:')) {
        await interaction.deferUpdate();
        const [, , pageStr, pageSizeStr] = interaction.customId.split(':');
        const phase = interaction.values?.[0] || 'global';
        if (!isValidPhase(phase)) {
          return interaction.editReply({ content: 'Nieprawidłowa faza rankingu.', components: [] });
        }
        const pageSize = clampInt(+pageSizeStr || DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

        const totalCount = await countParticipants(phase);
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const page = clampInt(+pageStr || 1, 1, totalPages);

        const userId = interaction.user.id;
        const { rows, myRank, myPoints } = await getPage(phase, page, pageSize, userId);
        const embed = buildRankingEmbed(
          phase,
          rows,
          page,
          totalPages,
          totalCount,
          { myRank, myPoints, requesterId: userId },
          pageSize
        );

        const components = [
          buildPhaseSelectRow(phase, page, pageSize),
          buildNavRow(phase, page, totalPages, pageSize, false),
        ];
        return interaction.editReply({ embeds: [embed], components });
      }
    } catch (err) {
      console.error('❌ ranking component error:', err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: 'Coś poszło nie tak przy odświeżaniu rankingu.', ephemeral: true });
      }
    }
  },
};
