const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");
const adminState = require("../../utils/matchAdminState");
const { logError } = require("../../utils/logger");
const { getMatchById } = require("../../utils/matchesStore");

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;

  return (
    perms?.has(PermissionFlagsBits.Administrator) ||
    perms?.has(PermissionFlagsBits.ManageGuild)
  );
}

module.exports = async function matchAdminMatchSelect(interaction) {
  try {
    // ============================================
    // GUILD
    // ============================================

    if (!interaction.guildId) {
      return interaction.reply({
        content: "❌ Ta akcja działa tylko na serwerze.",
        ephemeral: true,
      });
    }

    // ============================================
    // PERMISSIONS
    // ============================================

    if (!hasAdminPerms(interaction)) {
      return interaction.reply({
        content: "❌ Brak uprawnień.",
        ephemeral: true,
      });
    }

    // ============================================
    // MATCH ID
    // ============================================

    const raw = interaction.values?.[0];
    const matchId = Number(raw);

    if (!Number.isInteger(matchId) || matchId <= 0) {
      return interaction.update({
        content: "❌ Niepoprawny identyfikator meczu.",
        components: [],
      });
    }

    // ============================================
    // MATCH
    // ============================================

    return withGuild(interaction, async ({ pool, guildId }) => {
      const match = await getMatchById(pool, guildId, matchId);

      if (!match) {
        return interaction.update({
          content: "❌ Nie znaleziono meczu lub nie należy do tego serwera.",
          components: [],
        });
      }

      if (!match.event_id) {
        return interaction.update({
          content: "❌ Ten mecz nie ma przypisanego eventu.",
          components: [],
        });
      }

      const bestOf = Number(match.best_of);

      if (![1, 3, 5].includes(bestOf)) {
        return interaction.update({
          content: `❌ Nieobsługiwany format BO${bestOf}.`,
          components: [],
        });
      }

      // ============================================
      // ADMIN STATE
      // ============================================

      adminState.set(guildId, interaction.user.id, {
        matchId: match.id,
        teamA: match.team_a,
        teamB: match.team_b,
        bestOf,
        mapNo: 1,
      });

      // ============================================
      // EXACT BUTTON
      // ============================================

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("match_admin_exact_open")
          .setLabel(
            bestOf === 1
              ? "✍️ Wpisz oficjalny wynik"
              : "✍️ Wpisz wynik mapy #1",
          )
          .setStyle(ButtonStyle.Primary),
      );

      // ============================================
      // RESPONSE
      // ============================================

      return interaction.update({
        content:
          `🎯 **${match.team_a} vs ${match.team_b}** ` +
          `(BO${bestOf})\n\n` +
          (bestOf === 1
            ? "Wpisz dokładny oficjalny wynik meczu, np. **13:8**."
            : "Wpisuj dokładne wyniki map po kolei. " +
              "Wynik całej serii zostanie wyliczony **automatycznie**."),
        components: [row],
      });
    });
  } catch (err) {
    logError("matches", "matchAdminMatchSelect failed", {
      message: err.message,
      stack: err.stack,
    });

    try {
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Wystąpił błąd przy wyborze meczu.",
          components: [],
        });
      }

      return interaction.reply({
        content: "❌ Wystąpił błąd przy wyborze meczu.",
        ephemeral: true,
      });
    } catch (_) {
      return null;
    }
  }
};
