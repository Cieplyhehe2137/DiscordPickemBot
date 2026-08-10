const { EmbedBuilder } = require('discord.js');

const { withGuild } = require('../../utils/guildContext');
const { logError } = require('../../utils/logger');

function pct(value, total) {
  if (!total) return '—';
  return `${((Number(value) / Number(total)) * 100)
    .toFixed(1)
    .replace('.0', '')}%`;
}

function winnerSide(a, b) {
  const left = Number(a);
  const right = Number(b);

  if (!Number.isFinite(left) || !Number.isFinite(right) || left === right) {
    return 0;
  }

  return left > right ? 1 : -1;
}

function isWinnerCorrect(row) {
  const predicted = winnerSide(row.pred_a, row.pred_b);
  const official = winnerSide(row.res_a, row.res_b);

  return predicted !== 0 && predicted === official;
}

function isSeriesExact(row) {
  if (Number(row.best_of) === 1) {
    return (
      row.pred_exact_a != null &&
      row.pred_exact_b != null &&
      row.exact_a != null &&
      row.exact_b != null &&
      Number(row.pred_exact_a) === Number(row.exact_a) &&
      Number(row.pred_exact_b) === Number(row.exact_b)
    );
  }

  return (
    row.pred_a != null &&
    row.pred_b != null &&
    row.res_a != null &&
    row.res_b != null &&
    Number(row.pred_a) === Number(row.res_a) &&
    Number(row.pred_b) === Number(row.res_b)
  );
}

function calculateStreaks(rows) {
  let current = 0;
  let best = 0;

  for (const row of rows) {
    if (isWinnerCorrect(row)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return { current, best };
}

function formatBestMatch(row) {
  if (!row) return '—';

  const label = row.match_no ? `#${row.match_no} • ` : '';

  return (
    `${label}${row.team_a} vs ${row.team_b} — ` +
    `**${Number(row.points || 0)} pkt**`
  );
}

module.exports = async function showMyStats(interaction) {
  try {
    const customId = String(interaction.customId || '');
    const [action, rawEventId] = customId.split(':');

    if (action !== 'my_stats') return;

    const eventId = Number(rawEventId);

    if (!eventId) {
      return interaction.reply({
        content: '❌ Brak informacji o evencie.',
        ephemeral: true
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({
        ephemeral: true
      });
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      const userId = interaction.user.id;

      const [[event]] = await pool.query(
        `
        SELECT id, name
        FROM events
        WHERE id = ?
          AND guild_id = ?
        LIMIT 1
        `,
        [eventId, guildId]
      );

      if (!event) {
        return interaction.editReply({
          content: '❌ Nie znaleziono tego eventu.',
          embeds: [],
          components: []
        });
      }

      const [[predictionCount]] = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM match_predictions
        WHERE guild_id = ?
          AND event_id = ?
          AND user_id = ?
        `,
        [guildId, eventId, userId]
      );

      const totalPredictions = Number(
        predictionCount?.total || 0
      );

      if (!totalPredictions) {
        return interaction.editReply({
          content:
            `Nie masz jeszcze typów meczowych ` +
            `w evencie **${event.name}**.`,
          embeds: [],
          components: []
        });
      }

      const [settledRows] = await pool.query(
        `
        SELECT
          m.id AS match_id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of,
          mp.pred_a,
          mp.pred_b,
          mp.pred_exact_a,
          mp.pred_exact_b,
          mr.res_a,
          mr.res_b,
          mr.exact_a,
          mr.exact_b,
          mr.finished_at
        FROM match_predictions mp
        INNER JOIN matches m
          ON m.id = mp.match_id
         AND m.guild_id = mp.guild_id
         AND m.event_id = mp.event_id
        INNER JOIN match_results mr
          ON mr.match_id = mp.match_id
         AND mr.guild_id = mp.guild_id
         AND mr.event_id = mp.event_id
        WHERE mp.guild_id = ?
          AND mp.event_id = ?
          AND mp.user_id = ?
        ORDER BY mr.finished_at ASC, m.id ASC
        `,
        [guildId, eventId, userId]
      );

      const settledMatches = settledRows.length;

      const winnerHits = settledRows.filter(
        isWinnerCorrect
      ).length;

      const seriesExacts = settledRows.filter(
        isSeriesExact
      ).length;

      const {
        current: currentStreak,
        best: bestStreak
      } = calculateStreaks(settledRows);

      const form = settledRows
        .slice(-10)
        .map((row) =>
          isWinnerCorrect(row) ? '✅' : '❌'
        )
        .join(' ');

      const [mapRows] = await pool.query(
        `
        SELECT
          p.pred_exact_a,
          p.pred_exact_b,
          r.exact_a,
          r.exact_b
        FROM match_map_predictions p
        INNER JOIN match_map_results r
          ON r.guild_id = p.guild_id
         AND r.event_id = p.event_id
         AND r.match_id = p.match_id
         AND r.map_no = p.map_no
        WHERE p.guild_id = ?
          AND p.event_id = ?
          AND p.user_id = ?
        `,
        [guildId, eventId, userId]
      );

      const settledMaps = mapRows.length;

      const exactMaps = mapRows.filter((row) => (
        row.pred_exact_a != null &&
        row.pred_exact_b != null &&
        row.exact_a != null &&
        row.exact_b != null &&
        Number(row.pred_exact_a) === Number(row.exact_a) &&
        Number(row.pred_exact_b) === Number(row.exact_b)
      )).length;

      const [[points]] = await pool.query(
        `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN source = 'series'
                THEN points
                ELSE 0
              END
            ),
            0
          ) AS series_points,

          COALESCE(
            SUM(
              CASE
                WHEN source = 'map'
                THEN points
                ELSE 0
              END
            ),
            0
          ) AS map_points,

          COALESCE(SUM(points), 0) AS total_points

        FROM match_points
        WHERE guild_id = ?
          AND event_id = ?
          AND user_id = ?
        `,
        [guildId, eventId, userId]
      );

      const totalPoints = Number(
        points?.total_points || 0
      );

      const seriesPoints = Number(
        points?.series_points || 0
      );

      const mapPoints = Number(
        points?.map_points || 0
      );

      const averagePoints = settledMatches
        ? (totalPoints / settledMatches).toFixed(2)
        : '0.00';

      const [[bestMatch]] = await pool.query(
        `
        SELECT
          m.id AS match_id,
          m.match_no,
          m.team_a,
          m.team_b,
          SUM(mp.points) AS points
        FROM match_points mp
        INNER JOIN matches m
          ON m.id = mp.match_id
         AND m.guild_id = mp.guild_id
         AND m.event_id = mp.event_id
        WHERE mp.guild_id = ?
          AND mp.event_id = ?
          AND mp.user_id = ?
        GROUP BY
          m.id,
          m.match_no,
          m.team_a,
          m.team_b
        ORDER BY
          points DESC,
          m.match_no ASC,
          m.id ASC
        LIMIT 1
        `,
        [guildId, eventId, userId]
      );

      const embed = new EmbedBuilder()
        .setTitle(
          `📊 Twoje statystyki — ${event.name}`
        )
        .setColor(0x8b5cf6)
        .setDescription(
          `Statystyki typów meczowych w tym evencie.\n` +
          `Forma pokazuje **10 ostatnich rozliczonych typów**.`
        )
        .addFields(
          {
            name: '🎮 Typowanie',
            value:
              `Zapisane typy: **${totalPredictions}**\n` +
              `Rozliczone mecze: **${settledMatches}**`,
            inline: true
          },
          {
            name: '🏆 Zwycięzcy',
            value:
              `Trafione: **${winnerHits}/${settledMatches}**\n` +
              `Skuteczność: **${pct(
                winnerHits,
                settledMatches
              )}**`,
            inline: true
          },
          {
            name: '🎯 Exacty',
            value:
              `Serie: **${seriesExacts}/${settledMatches}**\n` +
              `Mapy: **${exactMaps}/${settledMaps || 0}** ` +
              `(${pct(exactMaps, settledMaps)})`,
            inline: true
          },
          {
            name: '⭐ Punkty',
            value:
              `Łącznie: **${totalPoints} pkt**\n` +
              `└ Serie: **${seriesPoints} pkt**\n` +
              `└ Mapy: **${mapPoints} pkt**\n` +
              `Średnia: **${averagePoints} pkt/mecz**`,
            inline: true
          },
          {
            name: '🔥 Serie trafień',
            value:
              `Aktualna: **${currentStreak}**\n` +
              `Najlepsza: **${bestStreak}**`,
            inline: true
          },
          {
            name: '📈 Forma',
            value:
              form || 'Brak rozliczonych typów.',
            inline: false
          },
          {
            name: '💎 Najlepszy mecz',
            value: formatBestMatch(bestMatch),
            inline: false
          }
        )
        .setFooter({
          text: 'Statystyki są widoczne tylko dla Ciebie.'
        });

      return interaction.editReply({
        content: '',
        embeds: [embed],
        components: []
      });
    });
  } catch (err) {
    logError('matches', 'showMyStats failed', {
      message: err.message,
      stack: err.stack
    });

    try {
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({
          content:
            '❌ Nie udało się pobrać Twoich statystyk.',
          ephemeral: true
        });
      }

      return interaction.editReply({
        content:
          '❌ Nie udało się pobrać Twoich statystyk.',
        embeds: [],
        components: []
      });
    } catch (_) {
      return null;
    }
  }
};