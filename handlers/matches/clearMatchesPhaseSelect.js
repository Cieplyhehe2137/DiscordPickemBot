// handlers/clearMatchesPhaseSelect.js
const { logInfo, logWarn, logError } = require("../../utils/logger");
const { PermissionFlagsBits } = require("discord.js");
const { withGuild } = require("../../utils/guildContext");
const { runInTransaction } = require("../../utils/runInTransaction");
const { getActiveEventId } = require("../../utils/getOpenEventId");

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return (
    perms?.has(PermissionFlagsBits.Administrator) ||
    perms?.has(PermissionFlagsBits.ManageGuild)
  );
}

module.exports = async function clearMatchesPhaseSelect(interaction) {
  const guildId = interaction.guildId;
  const phase = interaction.values?.[0];

  try {
    if (!hasAdminPerms(interaction)) {
      return interaction.reply({
        content: "❌ Brak uprawnień.",
        ephemeral: true,
      });
    }

    if (!guildId) {
      return interaction.reply({
        content: "❌ Brak kontekstu serwera (guildId).",
        ephemeral: true,
      });
    }

    if (!phase) {
      return interaction.update({
        content: "❌ Nie wybrano fazy.",
        components: [],
      });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      /*
       * TYLKO AKTYWNY TURNIEJ.
       *
       * Te cztery DELETE szly po serwerze i fazie. Wpis w logu nazywa to
       * "guild-safe" i to prawda - tylko ze event-safe nie bylo: faza
       * SWISS_STAGE1 na serwerze z dwoma turniejami znaczyla mecze OBU.
       * Wyczyszczenie fazy w nowym turnieju zabieralo poprzedniemu mecze,
       * typy, wyniki i punkty, bez zadnego ostrzezenia i bez odwrotu.
       *
       * Zmierzone na produkcji w chwili zgloszenia: guild 1161..., faza
       * SWISS_STAGE1 to 33 mecze IEM Cologne - turnieju zakonczonego,
       * z 10 328 typami i 20 395 wierszami punktow w calej bazie.
       */
      const eventId = await getActiveEventId(pool, guildId);

      if (!eventId) {
        return interaction.update({
          content: "❌ Brak aktywnego eventu - nie ma czego czyścić.",
          components: [],
        });
      }

      const { r1, r2, r3, r4 } = await runInTransaction(pool, async (conn) => {
        const [r1] = await conn.query(
          `
          DELETE mp
          FROM match_points mp
          JOIN matches m ON m.id = mp.match_id
          WHERE m.phase = ?
            AND m.guild_id = ?
            AND m.event_id = ?
          `,
          [phase, guildId, eventId],
        );

        const [r2] = await conn.query(
          `
          DELETE pr
          FROM match_predictions pr
          JOIN matches m ON m.id = pr.match_id
          WHERE m.phase = ?
            AND m.guild_id = ?
            AND m.event_id = ?
          `,
          [phase, guildId, eventId],
        );

        const [r3] = await conn.query(
          `
          DELETE mr
          FROM match_results mr
          JOIN matches m ON m.id = mr.match_id
          WHERE m.phase = ?
            AND m.guild_id = ?
            AND m.event_id = ?
          `,
          [phase, guildId, eventId],
        );

        const [r4] = await conn.query(
          `
          DELETE FROM matches
          WHERE phase = ?
            AND guild_id = ?
            AND event_id = ?
          `,
          [phase, guildId, eventId],
        );

        return { r1, r2, r3, r4 };
      });

      logInfo("matches", "Cleared matches phase (guild + event scoped)", {
        guildId,
        eventId,
        phase,
        deleted_points: r1?.affectedRows ?? 0,
        deleted_predictions: r2?.affectedRows ?? 0,
        deleted_results: r3?.affectedRows ?? 0,
        deleted_matches: r4?.affectedRows ?? 0,
        by: interaction.user?.id,
      });

      return interaction.update({
        content:
          `✅ Wyczyściłem fazę **${phase}**:\n` +
          `• punkty: **${r1?.affectedRows ?? 0}**\n` +
          `• typy: **${r2?.affectedRows ?? 0}**\n` +
          `• wyniki: **${r3?.affectedRows ?? 0}**\n` +
          `• mecze: **${r4?.affectedRows ?? 0}**`,
        components: [],
      });
    });
  } catch (err) {
    logError("matches", "clearMatchesPhaseSelect failed", {
      guildId,
      phase,
      message: err.message,
      stack: err.stack,
    });

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: "❌ Błąd podczas czyszczenia meczów.",
        ephemeral: true,
      });
    }
  }
};
