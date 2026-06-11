const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { PHASE_CHOICES, humanPhase, getSwissStageAliases } = require('../utils/phase');
const { withGuild } = require('../utils/guildContext');

/* =========================
   HELPERS
========================= */

function parseList(input) {
  if (input == null) return [];

  if (Array.isArray(input)) {
    if (input.length && typeof input[0] === 'object') {
      return input
        .map(o => (o?.label ?? o?.value ?? '').toString().trim())
        .filter(Boolean);
    }

    return input.map(x => (x ?? '').toString().trim()).filter(Boolean);
  }

  try {
    const parsed = JSON.parse(input);

    if (Array.isArray(parsed)) {
      if (parsed.length && typeof parsed[0] === 'object') {
        return parsed
          .map(o => (o?.label ?? o?.value ?? '').toString().trim())
          .filter(Boolean);
      }

      return parsed.map(x => (x ?? '').toString().trim()).filter(Boolean);
    }
  } catch (_) { }

  return String(input)
    .replace(/[[\]"]/g, '')
    .split(/[;,\n|]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function joinOrDash(arr) {
  return Array.isArray(arr) && arr.length ? arr.join(', ') : '—';
}

function normalizePhase(phase, stage = null) {
  if (!phase) return null;

  const p = String(phase).trim();
  const s = stage ? String(stage).trim() : null;

  if (p === 'swiss') {
    if (s === 'stage1') return 'swiss1';
    if (s === 'stage2') return 'swiss2';
    if (s === 'stage3') return 'swiss3';
  }

  if (p === 'swiss_stage_1') return 'swiss1';
  if (p === 'swiss_stage_2') return 'swiss2';
  if (p === 'swiss_stage_3') return 'swiss3';

  return p;
}

function humanPhaseSafe(phase) {
  if (phase === 'matches') return 'Mecze';
  return humanPhase(phase);
}

function pickWinnerFromValues(row, leftKey, rightKey, fallbackText = '—') {
  const teamA = row.team_a || 'Team A';
  const teamB = row.team_b || 'Team B';

  const aRaw = row[leftKey];
  const bRaw = row[rightKey];

  if (aRaw == null || bRaw == null) return fallbackText;

  const a = Number(aRaw);
  const b = Number(bRaw);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return fallbackText;

  if (a > b) return teamA;
  if (b > a) return teamB;

  return fallbackText;
}

function getPickedWinner(row) {
  if (row.pred_exact_a != null && row.pred_exact_b != null) {
    return pickWinnerFromValues(row, 'pred_exact_a', 'pred_exact_b', '—');
  }

  return pickWinnerFromValues(row, 'pred_a', 'pred_b', '—');
}

function getOfficialWinner(row) {
  if (row.result_exact_a != null && row.result_exact_b != null) {
    return pickWinnerFromValues(row, 'result_exact_a', 'result_exact_b', 'nierozliczone');
  }

  return pickWinnerFromValues(row, 'result_a', 'result_b', 'nierozliczone');
}

function formatPredictedScore(row) {
  if (row.pred_exact_a != null && row.pred_exact_b != null) {
    return `${row.pred_exact_a}:${row.pred_exact_b}`;
  }

  if (row.pred_a != null && row.pred_b != null) {
    return `${row.pred_a}:${row.pred_b}`;
  }

  return '—';
}

function formatOfficialResult(row) {
  if (row.result_exact_a != null && row.result_exact_b != null) {
    return `${row.result_exact_a}:${row.result_exact_b}`;
  }

  if (row.result_a != null && row.result_b != null) {
    return `${row.result_a}:${row.result_b}`;
  }

  return 'nierozliczone';
}

function formatMapScores(input) {
  if (input == null) return '—';

  const text = String(input).trim();

  if (!text || text === '—') return '—';

  return text;
}

async function loadMatchRows(pool, guildId, userId, eventId) {
  const [rows] = await pool.query(
    `
    SELECT
      mp.match_id,
      mp.guild_id,
      mp.event_id,
      mp.user_id,
      mp.pred_a,
      mp.pred_b,
      mp.pred_exact_a,
      mp.pred_exact_b,
      mp.updated_at,

      m.team_a,
      m.team_b,
      m.best_of,

      mr.res_a AS result_a,
      mr.res_b AS result_b,
      mr.exact_a AS result_exact_a,
      mr.exact_b AS result_exact_b,

      COALESCE(
        GROUP_CONCAT(
          DISTINCT CONCAT('Mapa ', mmp.map_no, ': ', mmp.pred_exact_a, ':', mmp.pred_exact_b)
          ORDER BY mmp.map_no ASC
          SEPARATOR '\n'
        ),
        '—'
      ) AS predicted_map_scores,

      COALESCE(
        GROUP_CONCAT(
          DISTINCT CONCAT('Mapa ', mmr.map_no, ': ', mmr.exact_a, ':', mmr.exact_b)
          ORDER BY mmr.map_no ASC
          SEPARATOR '\n'
        ),
        '—'
      ) AS official_map_scores

    FROM match_predictions mp

    INNER JOIN matches m
      ON m.id = mp.match_id
     AND m.guild_id = mp.guild_id
     AND m.event_id = mp.event_id

    LEFT JOIN match_results mr
      ON mr.match_id = mp.match_id
     AND mr.guild_id = mp.guild_id
     AND mr.event_id = mp.event_id

    LEFT JOIN match_map_predictions mmp
      ON mmp.match_id = mp.match_id
     AND mmp.guild_id = mp.guild_id
     AND mmp.event_id = mp.event_id
     AND mmp.user_id = mp.user_id

    LEFT JOIN match_map_results mmr
      ON mmr.match_id = mp.match_id
     AND mmr.guild_id = mp.guild_id
     AND mmr.event_id = mp.event_id

    WHERE mp.guild_id = ?
      AND mp.user_id = ?
      AND mp.event_id = ?

    GROUP BY
      mp.match_id,
      mp.guild_id,
      mp.event_id,
      mp.user_id,
      mp.pred_a,
      mp.pred_b,
      mp.pred_exact_a,
      mp.pred_exact_b,
      mp.updated_at,
      m.team_a,
      m.team_b,
      m.best_of,
      mr.res_a,
      mr.res_b,
      mr.exact_a,
      mr.exact_b

    ORDER BY mp.updated_at DESC, mp.match_id DESC
    `,
    [guildId, userId, eventId]
  );

  return rows;
}

function createMatchesEmbed(rows, page, pageSize, eventId) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  const embed = new EmbedBuilder()
    .setTitle('Twoje typy — Mecze')
    .setColor(0x3b82f6)
    .setDescription(
      `Event ID: **${eventId}**\n` +
      `Pokazuję **${start + 1}-${start + pageRows.length}** z **${rows.length}** zapisanych typów meczowych.\n` +
      `Strona **${safePage + 1}/${totalPages}**.`
    )
    .setFooter({ text: 'Widoczne tylko dla Ciebie.' });

  for (const r of pageRows) {
    const teamA = r.team_a || 'Team A';
    const teamB = r.team_b || 'Team B';

    embed.addFields({
      name: `#${r.match_id} • ${teamA} vs ${teamB}`,
      value:
        `**Twój zwycięzca:** ${getPickedWinner(r)}\n` +
        `**Twój wynik serii:** ${formatPredictedScore(r)}\n` +
        `**Twoje wyniki map:**\n${formatMapScores(r.predicted_map_scores)}\n\n` +
        `**Zwycięzca meczu:** ${getOfficialWinner(r)}\n` +
        `**Oficjalny wynik serii:** ${formatOfficialResult(r)}\n` +
        `**Oficjalne wyniki map:**\n${formatMapScores(r.official_map_scores)}`,
    });
  }

  return embed;
}

function createMatchesButtons(userId, page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`moje_typy_matches_prev_${userId}`)
      .setLabel('⬅️ Poprzednia')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),

    new ButtonBuilder()
      .setCustomId(`moje_typy_matches_next_${userId}`)
      .setLabel('Następna ➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

async function safeEditReply(interaction, payload) {
  try {
    return await interaction.editReply(payload);
  } catch (_) {
    return null;
  }
}

async function safeButtonUpdate(buttonInteraction, originalInteraction, payload) {
  try {
    if (!buttonInteraction.deferred && !buttonInteraction.replied) {
      await buttonInteraction.deferUpdate();
    }

    return await originalInteraction.editReply(payload);
  } catch (err) {
    if (err?.code === 10062 || err?.code === 40060 || err?.code === 10008) {
      console.warn('[moje_typy] pagination interaction expired/invalid:', err?.code);
      return null;
    }

    console.error('[moje_typy] pagination button error', err);
    return null;
  }
}

async function resolveLatestUserPhase(pool, guildId, userId) {
  const [last] = await pool.query(
    `
    SELECT phase, stage, event_id
    FROM (
      SELECT 'swiss' AS phase, stage, event_id, submitted_at
      FROM swiss_predictions
      WHERE guild_id = ? AND user_id = ?

      UNION ALL

      SELECT 'playoffs' AS phase, NULL AS stage, event_id, submitted_at
      FROM playoffs_predictions
      WHERE guild_id = ? AND user_id = ?

      UNION ALL

      SELECT 'double_elim' AS phase, NULL AS stage, event_id, submitted_at
      FROM doubleelim_predictions
      WHERE guild_id = ? AND user_id = ?

      UNION ALL

      SELECT 'playin' AS phase, NULL AS stage, event_id, submitted_at
      FROM playin_predictions
      WHERE guild_id = ? AND user_id = ?

      UNION ALL

      SELECT 'matches' AS phase, NULL AS stage, event_id, updated_at AS submitted_at
      FROM match_predictions
      WHERE guild_id = ? AND user_id = ?
    ) t
    ORDER BY submitted_at DESC
    LIMIT 1
    `,
    [
      guildId, userId,
      guildId, userId,
      guildId, userId,
      guildId, userId,
      guildId, userId,
    ]
  );

  if (!last.length) return null;

  return {
    phase: normalizePhase(last[0].phase, last[0].stage),
    eventId: last[0].event_id,
  };
}

async function resolveLatestEventForManualPhase(pool, guildId, userId, phase) {
  if (phase?.startsWith('swiss')) {
    const aliases = getSwissStageAliases(phase);

    let sql = `
      SELECT event_id
      FROM swiss_predictions
      WHERE guild_id = ?
        AND user_id = ?
    `;

    const params = [guildId, userId];

    if (aliases.length) {
      sql += ` AND stage IN (${aliases.map(() => '?').join(', ')})`;
      params.push(...aliases);
    }

    sql += `
      ORDER BY submitted_at DESC, id DESC
      LIMIT 1
    `;

    const [rows] = await pool.query(sql, params);
    return rows[0]?.event_id ?? null;
  }

  const tableByPhase = {
    playoffs: 'playoffs_predictions',
    double_elim: 'doubleelim_predictions',
    playin: 'playin_predictions',
  };

  if (tableByPhase[phase]) {
    const [rows] = await pool.query(
      `
      SELECT event_id
      FROM ${tableByPhase[phase]}
      WHERE guild_id = ?
        AND user_id = ?
      ORDER BY submitted_at DESC, id DESC
      LIMIT 1
      `,
      [guildId, userId]
    );

    return rows[0]?.event_id ?? null;
  }

  if (phase === 'matches') {
    const [rows] = await pool.query(
      `
      SELECT event_id
      FROM match_predictions
      WHERE guild_id = ?
        AND user_id = ?
      ORDER BY updated_at DESC, match_id DESC
      LIMIT 1
      `,
      [guildId, userId]
    );

    return rows[0]?.event_id ?? null;
  }

  return null;
}

/* =========================
   COMMAND
========================= */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moje_typy')
    .setDescription('Pokaż Twoje zapisane typy.')
    .addStringOption(opt =>
      opt
        .setName('faza')
        .setDescription('Wybierz fazę. Bez wyboru pokaże ostatnią z Twoimi typami.')
        .addChoices(
          ...PHASE_CHOICES.filter(c => c.value !== 'total'),
          { name: 'Mecze', value: 'matches' }
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Ta komenda działa tylko na serwerze.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const manualPhase = normalizePhase(interaction.options.getString('faza'));

    try {
      await withGuild(interaction, async ({ pool }) => {
        let phaseToShow = manualPhase;
        let eventIdToShow = null;

        if (!manualPhase) {
          const latest = await resolveLatestUserPhase(pool, guildId, userId);

          if (latest) {
            phaseToShow = latest.phase;
            eventIdToShow = latest.eventId;
          }
        } else {
          eventIdToShow = await resolveLatestEventForManualPhase(
            pool,
            guildId,
            userId,
            manualPhase
          );
        }

        if (!phaseToShow || !eventIdToShow) {
          return interaction.editReply({
            content: manualPhase
              ? 'Nie masz jeszcze zapisanych typów dla tej fazy.'
              : 'Nie masz jeszcze żadnych zapisanych typów.',
            components: [],
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`Twoje typy — ${humanPhaseSafe(phaseToShow)}`)
          .setColor(0x3b82f6)
          .setDescription(`Event ID: **${eventIdToShow}**`)
          .setFooter({ text: 'Widoczne tylko dla Ciebie.' });

        if (phaseToShow.startsWith('swiss')) {
          const aliases = getSwissStageAliases(phaseToShow);

          let sql = `
            SELECT *
            FROM swiss_predictions
            WHERE guild_id = ?
              AND user_id = ?
              AND event_id = ?
          `;

          const params = [guildId, userId, eventIdToShow];

          if (aliases.length) {
            sql += ` AND stage IN (${aliases.map(() => '?').join(', ')})`;
            params.push(...aliases);
          }

          sql += `
            ORDER BY submitted_at DESC, id DESC
            LIMIT 1
          `;

          const [rows] = await pool.query(sql, params);

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
              components: [],
            });
          }

          const r = rows[0];

          embed.addFields(
            { name: '3-0 (2)', value: joinOrDash(parseList(r.pick_3_0)) },
            { name: '0-3 (2)', value: joinOrDash(parseList(r.pick_0_3)) },
            { name: 'Awansujące (6)', value: joinOrDash(parseList(r.advancing)) },
          );

          return interaction.editReply({ embeds: [embed], components: [] });
        }

        if (phaseToShow === 'playoffs') {
          const [rows] = await pool.query(
            `
            SELECT *
            FROM playoffs_predictions
            WHERE guild_id = ?
              AND user_id = ?
              AND event_id = ?
            ORDER BY submitted_at DESC, id DESC
            LIMIT 1
            `,
            [guildId, userId, eventIdToShow]
          );

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
              components: [],
            });
          }

          const r = rows[0];

          embed.addFields(
            { name: 'Półfinaliści (4)', value: joinOrDash(parseList(r.semifinalists)) },
            { name: 'Finaliści (2)', value: joinOrDash(parseList(r.finalists)) },
            { name: 'Zwycięzca', value: joinOrDash(parseList(r.winner)), inline: true },
            { name: '3. miejsce', value: joinOrDash(parseList(r.third_place_winner)), inline: true },
          );

          return interaction.editReply({ embeds: [embed], components: [] });
        }

        if (phaseToShow === 'double_elim') {
          const [rows] = await pool.query(
            `
            SELECT *
            FROM doubleelim_predictions
            WHERE guild_id = ?
              AND user_id = ?
              AND event_id = ?
            ORDER BY submitted_at DESC, id DESC
            LIMIT 1
            `,
            [guildId, userId, eventIdToShow]
          );

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
              components: [],
            });
          }

          const r = rows[0];

          embed.addFields(
            { name: 'Upper Final A (2)', value: joinOrDash(parseList(r.upper_final_a)) },
            { name: 'Lower Final A (2)', value: joinOrDash(parseList(r.lower_final_a)) },
            { name: 'Upper Final B (2)', value: joinOrDash(parseList(r.upper_final_b)) },
            { name: 'Lower Final B (2)', value: joinOrDash(parseList(r.lower_final_b)) },
          );

          return interaction.editReply({ embeds: [embed], components: [] });
        }

        if (phaseToShow === 'playin') {
          const [rows] = await pool.query(
            `
            SELECT *
            FROM playin_predictions
            WHERE guild_id = ?
              AND user_id = ?
              AND event_id = ?
            ORDER BY submitted_at DESC, id DESC
            LIMIT 1
            `,
            [guildId, userId, eventIdToShow]
          );

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
              components: [],
            });
          }

          embed.addFields({
            name: 'Wytypowane drużyny',
            value: joinOrDash(parseList(rows[0].teams)),
          });

          return interaction.editReply({ embeds: [embed], components: [] });
        }

        if (phaseToShow === 'matches') {
          const rows = await loadMatchRows(pool, guildId, userId, eventIdToShow);

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Nie masz jeszcze zapisanych typów meczowych.')],
              components: [],
            });
          }

          const pageSize = 10;
          let page = 0;
          const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

          const message = await interaction.editReply({
            embeds: [createMatchesEmbed(rows, page, pageSize, eventIdToShow)],
            components: totalPages > 1
              ? [createMatchesButtons(userId, page, totalPages)]
              : [],
          });

          if (totalPages <= 1) return;

          const collector = message.createMessageComponentCollector({
            time: 5 * 60 * 1000,
            filter: i =>
              i.user.id === userId &&
              (
                i.customId === `moje_typy_matches_prev_${userId}` ||
                i.customId === `moje_typy_matches_next_${userId}`
              ),
          });

          collector.on('collect', async i => {
            if (i.customId === `moje_typy_matches_prev_${userId}`) {
              page = Math.max(0, page - 1);
            }

            if (i.customId === `moje_typy_matches_next_${userId}`) {
              page = Math.min(totalPages - 1, page + 1);
            }

            await safeButtonUpdate(i, interaction, {
              embeds: [createMatchesEmbed(rows, page, pageSize, eventIdToShow)],
              components: [createMatchesButtons(userId, page, totalPages)],
            });
          });

          collector.on('end', async () => {
            await safeEditReply(interaction, { components: [] });
          });

          return;
        }

        return interaction.editReply({
          embeds: [embed.setDescription('Nieobsługiwana faza.')],
          components: [],
        });
      });
    } catch (err) {
      console.error('[moje_typy] error', err);

      return interaction.editReply({
        content: '⚠️ Wystąpił błąd podczas pobierania typów.',
        components: [],
      });
    }
  },
};