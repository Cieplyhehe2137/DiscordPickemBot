// handlers/clearMatchesPhaseSelect.js
const { logInfo, logWarn, logError } = require("../../utils/logger");
const { PermissionFlagsBits } = require("discord.js");
const { withGuild } = require("../../utils/guildContext");
const { runInTransaction } = require("../../utils/runInTransaction");

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
      const { r1, r2, r3, r4 } = await runInTransaction(pool, async (conn) => {
        const [r1] = await conn.query(
          `
          DELETE mp
          FROM match_points mp
          JOIN matches m ON m.id = mp.match_id
          WHERE m.phase = ?
            AND m.guild_id = ?
          `,
          [phase, guildId],
        );

        const [r2] = await conn.query(
          `
          DELETE pr
          FROM match_predictions pr
          JOIN matches m ON m.id = pr.match_id
          WHERE m.phase = ?
            AND m.guild_id = ?
          `,
          [phase, guildId],
        );

        const [r3] = await conn.query(
          `
          DELETE mr
          FROM match_results mr
          JOIN matches m ON m.id = mr.match_id
          WHERE m.phase = ?
            AND m.guild_id = ?
          `,
          [phase, guildId],
        );

        const [r4] = await conn.query(
          `
          DELETE FROM matches
          WHERE phase = ?
            AND guild_id = ?
          `,
          [phase, guildId],
        );

        return { r1, r2, r3, r4 };
      });

      logInfo("matches", "Cleared matches phase (guild-safe)", {
        guildId,
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
