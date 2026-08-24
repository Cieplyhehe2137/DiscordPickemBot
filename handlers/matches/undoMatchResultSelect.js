const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const isAdmin = require("../../utils/isAdmin");
const { withGuild } = require("../../utils/guildContext");
const { logError } = require("../../utils/logger");

module.exports = async function undoMatchResultSelect(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) {
      return;
    }

    if (interaction.customId !== "undo_match_result_select") {
      return;
    }

    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: "❌ Brak uprawnień.",
        ephemeral: true,
      });
    }

    const matchId = Number(interaction.values?.[0]);

    if (!matchId) {
      return interaction.update({
        content: "❌ Nieprawidłowy mecz.",
        embeds: [],
        components: [],
      });
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      const [[match]] = await pool.query(
        `
          SELECT
            m.id,
            m.event_id,
            m.phase,
            m.match_no,
            m.team_a,
            m.team_b,
            m.best_of,

            mr.res_a,
            mr.res_b,
            mr.finished_at

          FROM matches m

          INNER JOIN match_results mr
            ON mr.guild_id = m.guild_id
           AND mr.event_id = m.event_id
           AND mr.match_id = m.id

          WHERE m.guild_id = ?
            AND m.id = ?

          LIMIT 1
          `,
        [guildId, matchId],
      );

      if (!match) {
        return interaction.update({
          content: "❌ Ten mecz nie posiada już wyniku.",
          embeds: [],
          components: [],
        });
      }

      const [[mapCount]] = await pool.query(
        `
            SELECT
              COUNT(*) AS total
            FROM match_map_results
            WHERE guild_id = ?
              AND event_id = ?
              AND match_id = ?
            `,
        [guildId, match.event_id, match.id],
      );

      const [[points]] = await pool.query(
        `
            SELECT
              COUNT(*) AS rows_count,
              COALESCE(
                SUM(points),
                0
              ) AS total_points

            FROM match_points

            WHERE guild_id = ?
              AND event_id = ?
              AND match_id = ?
            `,
        [guildId, match.event_id, match.id],
      );

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("⚠️ Potwierdź cofnięcie wyniku")
        .setDescription(
          `### ${match.team_a} **${match.res_a}:${match.res_b}** ${match.team_b}\n\n` +
            `🎮 Mecz: **#${match.match_no || match.id}**\n` +
            `📋 Faza: **${match.phase}**\n` +
            `🗺️ Wyniki map do usunięcia: **${Number(mapCount?.total || 0)}**\n` +
            `⭐ Punktów do usunięcia: **${Number(points?.total_points || 0)}**\n\n` +
            "### Zostanie usunięte:\n" +
            "• wynik serii\n" +
            "• oficjalne wyniki map\n" +
            "• wszystkie punkty za ten mecz\n\n" +
            "✅ **Typy użytkowników NIE zostaną usunięte.**",
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`undo_match_result_confirm:${match.id}`)
          .setLabel("Cofnij wynik")
          .setEmoji("↩️")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("undo_match_result_cancel")
          .setLabel("Anuluj")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Secondary),
      );

      return interaction.update({
        content: "",
        embeds: [embed],
        components: [row],
      });
    });
  } catch (err) {
    logError("matches", "undoMatchResultSelect failed", {
      message: err.message,
      stack: err.stack,
    });
  }
};
