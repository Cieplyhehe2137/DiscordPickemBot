// handlers/stats/showMyCareer.js

const { EmbedBuilder } = require("discord.js");

const { withGuild } = require("../../utils/guildContext");
const { logError } = require("../../utils/logger");

function pct(value, total) {
  if (!total) return "—";

  return `${((Number(value) / Number(total)) * 100)
    .toFixed(1)
    .replace(".0", "")}%`;
}

function formatRank(rank) {
  const value = Number(rank);

  if (value === 1) return "🥇 #1";
  if (value === 2) return "🥈 #2";
  if (value === 3) return "🥉 #3";

  return `#${value}`;
}

function formatHistory(rows) {
  if (!rows.length) {
    return "Brak zakończonych eventów.";
  }

  return rows
    .slice(0, 5)
    .reverse()
    .map((row) => {
      const rank = Number(row.final_rank);

      if (rank === 1) return "🥇";
      if (rank === 2) return "🥈";
      if (rank === 3) return "🥉";

      return `#${rank}`;
    })
    .join(" → ");
}

module.exports = async function showMyCareer(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({
        ephemeral: true,
      });
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      const userId = interaction.user.id;

      // ==================================================
      // HISTORIA EVENTÓW
      // ==================================================

      const [history] = await pool.query(
        `
          SELECT
            event_id,
            event_name,

            final_rank,
            participant_count,

            total_points,
            series_points,
            map_points,

            predictions,
            settled_matches,

            winner_hits,
            series_exacts,

            settled_maps,
            map_winner_hits,
            exact_maps,

            best_streak,

            finished_at

          FROM player_event_history

          WHERE guild_id = ?
            AND user_id = ?

          ORDER BY
            finished_at DESC,
            event_id DESC
        `,
        [guildId, userId],
      );

      if (!history.length) {
        return interaction.editReply({
          content:
            "🏆 Nie masz jeszcze historii kariery.\n\n" +
            "Pierwszy wpis pojawi się po zakończeniu eventu.",
          embeds: [],
          components: [],
        });
      }

      // ==================================================
      // PODSTAWOWE SUMY
      // ==================================================

      const eventsPlayed = history.length;

      const totalPoints = history.reduce(
        (sum, row) => sum + Number(row.total_points || 0),
        0,
      );

      const seriesPoints = history.reduce(
        (sum, row) => sum + Number(row.series_points || 0),
        0,
      );

      const mapPoints = history.reduce(
        (sum, row) => sum + Number(row.map_points || 0),
        0,
      );

      const totalPredictions = history.reduce(
        (sum, row) => sum + Number(row.predictions || 0),
        0,
      );

      const settledMatches = history.reduce(
        (sum, row) => sum + Number(row.settled_matches || 0),
        0,
      );

      const winnerHits = history.reduce(
        (sum, row) => sum + Number(row.winner_hits || 0),
        0,
      );

      const seriesExacts = history.reduce(
        (sum, row) => sum + Number(row.series_exacts || 0),
        0,
      );

      const settledMaps = history.reduce(
        (sum, row) => sum + Number(row.settled_maps || 0),
        0,
      );

      const mapWinnerHits = history.reduce(
        (sum, row) => sum + Number(row.map_winner_hits || 0),
        0,
      );

      const exactMaps = history.reduce(
        (sum, row) => sum + Number(row.exact_maps || 0),
        0,
      );

      // ==================================================
      // OSIĄGNIĘCIA
      // ==================================================

      const wins = history.filter((row) => Number(row.final_rank) === 1).length;

      const podiums = history.filter(
        (row) => Number(row.final_rank) <= 3,
      ).length;

      const top10 = history.filter(
        (row) => Number(row.final_rank) <= 10,
      ).length;

      // ==================================================
      // NAJLEPSZY EVENT
      // ==================================================

      const bestEvent = [...history].sort((a, b) => {
        const rankDifference = Number(a.final_rank) - Number(b.final_rank);

        if (rankDifference !== 0) {
          return rankDifference;
        }

        return Number(b.total_points) - Number(a.total_points);
      })[0];

      // ==================================================
      // REKORD SERII
      // ==================================================

      const bestStreak = history.reduce(
        (best, row) => Math.max(best, Number(row.best_streak || 0)),
        0,
      );

      // ==================================================
      // ŚREDNIE
      // ==================================================

      const averagePoints = eventsPlayed > 0 ? totalPoints / eventsPlayed : 0;

      const averageRank =
        history.reduce((sum, row) => sum + Number(row.final_rank || 0), 0) /
        eventsPlayed;

      const averageTopPercent =
        history.reduce((sum, row) => {
          const rank = Number(row.final_rank || 0);
          const participants = Number(row.participant_count || 0);

          if (!rank || !participants) {
            return sum;
          }

          return sum + (rank / participants) * 100;
        }, 0) / eventsPlayed;

      // ==================================================
      // HISTORIA
      // ==================================================

      const recentHistory = formatHistory(history);

      const recentEventsText = history
        .slice(0, 5)
        .map((row) => {
          return (
            `${formatRank(row.final_rank)} • ` +
            `**${row.event_name}** • ` +
            `${Number(row.total_points || 0)} pkt`
          );
        })
        .join("\n");

      // ==================================================
      // EMBED
      // ==================================================

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("🏆 Twoja kariera Pick'Em")
        .setDescription(
          `Podsumowanie Twoich wyników ze wszystkich ` +
            `zakończonych eventów.`,
        )
        .setAuthor({
          name: interaction.member?.displayName || interaction.user.username,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .addFields(
          {
            name: "🎮 Eventy",
            value:
              `Rozegrane: **${eventsPlayed}**\n` +
              `Typy: **${totalPredictions}**`,
            inline: true,
          },

          {
            name: "⭐ Punkty kariery",
            value:
              `Łącznie: **${totalPoints} pkt**\n` +
              `Średnio: **${averagePoints.toFixed(1)} pkt / event**`,
            inline: true,
          },

          {
            name: "📊 Średnia pozycja",
            value:
              `**#${averageRank.toFixed(1)}**\n` +
              `Średni TOP: **${averageTopPercent
                .toFixed(1)
                .replace(".0", "")}%**`,
            inline: true,
          },

          {
            name: "🏆 Najlepszy wynik",
            value:
              `${formatRank(bestEvent.final_rank)} / ` +
              `${Number(bestEvent.participant_count)}\n` +
              `**${bestEvent.event_name}**`,
            inline: true,
          },

          {
            name: "🏅 Sukcesy",
            value:
              `🥇 Zwycięstwa: **${wins}**\n` +
              `🥉 Podia: **${podiums}**\n` +
              `🔟 TOP 10: **${top10}**`,
            inline: true,
          },

          {
            name: "🔥 Rekord kariery",
            value: `Najlepsza seria:\n` + `**${bestStreak} trafień**`,
            inline: true,
          },

          {
            name: "🎯 Skuteczność serii",
            value:
              `🏆 Zwycięzcy: **${winnerHits}/${settledMatches}** ` +
              `(${pct(winnerHits, settledMatches)})\n` +
              `🎯 Exact: **${seriesExacts}/${settledMatches}** ` +
              `(${pct(seriesExacts, settledMatches)})`,
            inline: false,
          },

          {
            name: "🗺️ Skuteczność map",
            value:
              `🏆 Zwycięzcy: **${mapWinnerHits}/${settledMaps}** ` +
              `(${pct(mapWinnerHits, settledMaps)})\n` +
              `💯 Exact: **${exactMaps}/${settledMaps}** ` +
              `(${pct(exactMaps, settledMaps)})`,
            inline: false,
          },

          {
            name: "📦 Źródła punktów",
            value:
              `Serie: **${seriesPoints} pkt** • ` +
              `Mapy: **${mapPoints} pkt**`,
            inline: false,
          },

          {
            name: "📈 Ostatnie wyniki",
            value: recentHistory,
            inline: false,
          },

          {
            name: "📜 Ostatnie eventy",
            value: recentEventsText,
            inline: false,
          },
        )
        .setFooter({
          text:
            `${eventsPlayed} eventów • ` +
            `${settledMatches} rozliczonych meczów`,
        });

      return interaction.editReply({
        content: "",
        embeds: [embed],
        components: [],
      });
    });
  } catch (err) {
    logError("stats", "showMyCareer failed", {
      message: err?.message,
      stack: err?.stack,
    });

    try {
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({
          content: "❌ Nie udało się pobrać historii kariery.",
          ephemeral: true,
        });
      }

      return interaction.editReply({
        content: "❌ Nie udało się pobrać historii kariery.",
        embeds: [],
        components: [],
      });
    } catch (_) {
      return null;
    }
  }
};
