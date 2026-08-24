const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");
const { getActiveEventId } = require("../../utils/getOpenEventId");
const { logError } = require("../../utils/logger");

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

module.exports = async function eventAuditMatchSelect(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "⛔ Tylko administracja.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({
    ephemeral: true,
  });

  try {
    return withGuild(interaction, async ({ guildId, pool }) => {
      const eventId = await getActiveEventId(pool, guildId);

      if (!eventId) {
        return interaction.editReply({
          content: "❌ Nie znaleziono aktywnego eventu.",
        });
      }

      const [matches] = await pool.query(
        `
        SELECT
          id,
          match_no,
          team_a,
          team_b,
          best_of,
          is_locked

        FROM matches

        WHERE guild_id = ?
          AND event_id = ?

        ORDER BY
          match_no ASC,
          id ASC

        LIMIT 25
        `,
        [guildId, eventId],
      );

      if (!matches.length) {
        return interaction.editReply({
          content: "❌ Ten event nie ma żadnych meczów.",
        });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId("panel:audit:match:select")
        .setPlaceholder("Wybierz mecz do diagnostyki")
        .addOptions(
          matches.map((match) => ({
            label:
              `#${match.match_no ?? match.id} ` +
              `${match.team_a} vs ${match.team_b}`,

            description:
              `BO${match.best_of} • ` +
              `${Number(match.is_locked) ? "Zablokowany" : "Otwarty"}`,

            value: String(match.id),
          })),
        );

      const row = new ActionRowBuilder().addComponents(select);

      return interaction.editReply({
        content: "🎮 **Wybierz mecz do diagnostyki:**",
        components: [row],
      });
    });
  } catch (err) {
    logError("audit", "eventAuditMatchSelect failed", {
      guildId: interaction.guildId,
      userId: interaction.user?.id || null,
      message: err.message,
      stack: err.stack,
    });

    return interaction.editReply({
      content: "❌ Nie udało się pobrać listy meczów.",
      components: [],
    });
  }
};
