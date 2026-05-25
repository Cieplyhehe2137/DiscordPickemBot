const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

function getPredictionWinner(row) {
  return (
    row.predicted_winner ||
    row.winner ||
    row.pick ||
    row.team ||
    row.selected_team ||
    '—'
  );
}

function getPredictionScore(row) {
  if (row.predicted_score) return row.predicted_score;
  if (row.series_score) return row.series_score;

  if (row.predicted_score_a != null && row.predicted_score_b != null) {
    return `${row.predicted_score_a}:${row.predicted_score_b}`;
  }

  if (row.score_a != null && row.score_b != null) {
    return `${row.score_a}:${row.score_b}`;
  }

  return '—';
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
        .setDescription('Wybierz fazę. Bez wyboru pokaże aktywną lub ostatnią z Twoimi typami.')
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
        let autoPhase = null;

        if (!manualPhase) {
          const [panels] = await pool.query(
            `
            SELECT phase, stage
            FROM active_panels
            WHERE guild_id = ?
              AND active = 1
            ORDER BY id DESC
            LIMIT 1
            `,
            [guildId]
          );

          if (panels.length) {
            autoPhase = normalizePhase(panels[0].phase, panels[0].stage);
          }
        }

        if (!manualPhase && !autoPhase) {
          const [last] = await pool.query(
            `
            SELECT phase, stage
            FROM (
              SELECT 'swiss' AS phase, stage, submitted_at
              FROM swiss_predictions
              WHERE guild_id = ? AND user_id = ?

              UNION ALL

              SELECT 'playoffs' AS phase, NULL AS stage, submitted_at
              FROM playoffs_predictions
              WHERE guild_id = ? AND user_id = ?

              UNION ALL

              SELECT 'double_elim' AS phase, NULL AS stage, submitted_at
              FROM doubleelim_predictions
              WHERE guild_id = ? AND user_id = ?

              UNION ALL

              SELECT 'playin' AS phase, NULL AS stage, submitted_at
              FROM playin_predictions
              WHERE guild_id = ? AND user_id = ?

              UNION ALL

              SELECT 'matches' AS phase, NULL AS stage, submitted_at
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

          if (last.length) {
            autoPhase = normalizePhase(last[0].phase, last[0].stage);
          }
        }

        const phaseToShow = manualPhase || autoPhase;

        if (!phaseToShow) {
          return interaction.editReply({
            content: 'Nie masz jeszcze żadnych zapisanych typów.',
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`Twoje typy — ${humanPhaseSafe(phaseToShow)}`)
          .setColor(0x3b82f6)
          .setFooter({ text: 'Widoczne tylko dla Ciebie.' });

        /* =========================
           SWISS
        ========================= */

        if (phaseToShow.startsWith('swiss')) {
          const aliases = getSwissStageAliases(phaseToShow);

          let sql = `
            SELECT *
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

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
            });
          }

          const r = rows[0];

          embed.addFields(
            { name: '3-0 (2)', value: joinOrDash(parseList(r.pick_3_0)) },
            { name: '0-3 (2)', value: joinOrDash(parseList(r.pick_0_3)) },
            { name: 'Awansujące (6)', value: joinOrDash(parseList(r.advancing)) },
          );

          return interaction.editReply({ embeds: [embed] });
        }

        /* =========================
           PLAYOFFS
        ========================= */

        if (phaseToShow === 'playoffs') {
          const [rows] = await pool.query(
            `
            SELECT *
            FROM playoffs_predictions
            WHERE guild_id = ?
              AND user_id = ?
            ORDER BY submitted_at DESC, id DESC
            LIMIT 1
            `,
            [guildId, userId]
          );

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
            });
          }

          const r = rows[0];

          embed.addFields(
            { name: 'Półfinaliści (4)', value: joinOrDash(parseList(r.semifinalists)) },
            { name: 'Finaliści (2)', value: joinOrDash(parseList(r.finalists)) },
            { name: 'Zwycięzca', value: joinOrDash(parseList(r.winner)), inline: true },
            { name: '3. miejsce', value: joinOrDash(parseList(r.third_place_winner)), inline: true },
          );

          return interaction.editReply({ embeds: [embed] });
        }

        /* =========================
           DOUBLE ELIM
        ========================= */

        if (phaseToShow === 'double_elim') {
          const [rows] = await pool.query(
            `
            SELECT *
            FROM doubleelim_predictions
            WHERE guild_id = ?
              AND user_id = ?
            ORDER BY submitted_at DESC, id DESC
            LIMIT 1
            `,
            [guildId, userId]
          );

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
            });
          }

          const r = rows[0];

          embed.addFields(
            { name: 'Upper Final A (2)', value: joinOrDash(parseList(r.upper_final_a)) },
            { name: 'Lower Final A (2)', value: joinOrDash(parseList(r.lower_final_a)) },
            { name: 'Upper Final B (2)', value: joinOrDash(parseList(r.upper_final_b)) },
            { name: 'Lower Final B (2)', value: joinOrDash(parseList(r.lower_final_b)) },
          );

          return interaction.editReply({ embeds: [embed] });
        }

        /* =========================
           PLAY-IN
        ========================= */

        if (phaseToShow === 'playin') {
          const [rows] = await pool.query(
            `
            SELECT *
            FROM playin_predictions
            WHERE guild_id = ?
              AND user_id = ?
            ORDER BY submitted_at DESC, id DESC
            LIMIT 1
            `,
            [guildId, userId]
          );

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
            });
          }

          embed.addFields({
            name: 'Wytypowane drużyny',
            value: joinOrDash(parseList(rows[0].teams)),
          });

          return interaction.editReply({ embeds: [embed] });
        }

        /* =========================
           MATCHES / SERIES
        ========================= */

        if (phaseToShow === 'matches') {
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
    mr.score_a AS result_score_a,
    mr.score_b AS result_score_b,
    pts.points AS earned_points
  FROM match_predictions mp
  INNER JOIN matches m
    ON m.id = mp.match_id
   AND m.guild_id = mp.guild_id
  LEFT JOIN match_results mr
    ON mr.match_id = m.id
   AND mr.guild_id = m.guild_id
  LEFT JOIN match_points pts
    ON pts.match_id = m.id
   AND pts.guild_id = mp.guild_id
   AND pts.user_id = mp.user_id
  WHERE mp.guild_id = ?
    AND mp.user_id = ?
  ORDER BY mp.updated_at DESC, m.id DESC
  LIMIT 10
  `,
            [guildId, userId]
          );

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Nie masz jeszcze zapisanych typów meczowych.')],
            });
          }

          for (const r of rows.slice(0, 10)) {
            const teamA = r.team_a || 'Team A';
            const teamB = r.team_b || 'Team B';

            const pickedWinner = getPredictionWinner(r);
            const predictedScore = getPredictionScore(r);

            const officialResult =
              r.result_score_a != null && r.result_score_b != null
                ? `${r.result_score_a}:${r.result_score_b}`
                : 'nierozliczone';

            const points =
              r.earned_points != null
                ? `${r.earned_points} pkt`
                : 'jeszcze brak';

            embed.addFields({
              name: `${teamA} vs ${teamB}`,
              value:
                `**Twój zwycięzca:** ${pickedWinner}\n` +
                `**Twój wynik serii:** ${predictedScore}\n` +
                `**Oficjalny wynik:** ${officialResult}\n` +
                `**Punkty:** ${points}`,
            });
          }

          return interaction.editReply({ embeds: [embed] });
        }

        return interaction.editReply({
          embeds: [embed.setDescription('Nieobsługiwana faza.')],
        });
      });
    } catch (err) {
      console.error('[moje_typy] error', err);

      return interaction.editReply({
        content: '⚠️ Wystąpił błąd podczas pobierania typów.',
      });
    }
  },
};