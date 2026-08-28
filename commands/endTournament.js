const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const { logInfo, logWarn, logError } = require("../utils/logger");

const exportClassification = require("../handlers/admin/exportClassification");

const sendArchivePanel = require("../utils/sendArchivePanel");

const { withGuild } = require("../utils/guildContext");

const { getOpenEventId } = require("../utils/getOpenEventId");

const { getGuildConfig } = require("../utils/guildRegistry");

const { logTournamentAction } = require("../utils/logTournamentAction");

// ======================================================
// BLOKADA PER GUILD
// ======================================================

const ENDING_GUILDS = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("end_tournament")
    .setDescription("Zamyka turniej Pick'Em, eksportuje dane i tworzy archiwum")
    .addStringOption((option) =>
      option
        .setName("nazwa_pliku")
        .setDescription("Nazwa pliku archiwum (bez .xlsx)")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({
      ephemeral: true,
    });

    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.editReply(
        "❌ Ta komenda działa tylko na serwerze (nie w DM).",
      );
    }

    if (ENDING_GUILDS.has(guildId)) {
      return interaction.editReply(
        "⏳ Operacja kończenia turnieju już trwa na tym serwerze.",
      );
    }

    return withGuild({ guildId }, async ({ pool }) => {
      let conn = null;

      try {
        ENDING_GUILDS.add(guildId);

        // ==================================================
        // KONFIGURACJA
        // ==================================================

        const cfg = getGuildConfig(guildId);

        const archiveChannelId = cfg?.ARCHIVE_CHANNEL_ID;

        if (!archiveChannelId) {
          return interaction.editReply(
            "❌ Brak `ARCHIVE_CHANNEL_ID` w konfiguracji tego serwera.",
          );
        }

        // ==================================================
        // AKTYWNY EVENT
        // ==================================================
        //
        // Single source of truth:
        //
        // status    = OPEN
        // is_open   = 1
        // is_active = 1
        //
        // Nie używamy już fallbacku:
        //
        // is_active = 1 OR is_open = 1 OR status = 'OPEN'
        // ==================================================

        const eventId = await getOpenEventId(pool, guildId);

        if (!eventId) {
          return interaction.editReply(
            "❌ Nie znaleziono aktywnego eventu do zakończenia.",
          );
        }

        const [[event]] = await pool.query(
          `
          SELECT
            id,
            name,
            slug,
            phase,
            status,
            is_open,
            is_active
          FROM events
          WHERE guild_id = ?
            AND id = ?
          LIMIT 1
          `,
          [guildId, eventId],
        );

        if (!event) {
          return interaction.editReply(
            "❌ Nie znaleziono danych aktywnego eventu.",
          );
        }

        // ==================================================
        // NAZWA PLIKU
        // ==================================================

        const rawName = interaction.options.getString("nazwa_pliku") || "";

        const safeBase = rawName.trim().replace(/[^a-zA-Z0-9_-]/g, "_");

        if (!safeBase) {
          return interaction.editReply("❌ Podaj poprawną nazwę pliku.");
        }

        const filename = `${safeBase}.xlsx`;

        // ==================================================
        // ŚCIEŻKA ARCHIWUM
        // ==================================================

        const archiveDir = path.join(
          __dirname,
          "..",
          "archiwum",
          String(guildId),
        );

        const filePath = path.join(archiveDir, filename);

        fs.mkdirSync(archiveDir, {
          recursive: true,
        });

        // ==================================================
        // ZAMKNIĘCIE PANELI W DB
        // ==================================================

        await pool.query(
          `
          UPDATE active_panels
          SET
            closed = 1,
            closed_at = NOW(),
            active = 0
          WHERE guild_id = ?
            AND closed = 0
          `,
          [guildId],
        );

        // ==================================================
        // EKSPORT
        //
        // Robimy PRZED czyszczeniem danych.
        // ==================================================

        await exportClassification({
          guildId,
          outputPath: filePath,
        });

        // ==================================================
        // ARCHIVE FILE
        // ==================================================

        await pool.query(
          `
          INSERT INTO archive_files (
            guild_id,
            filename,
            path
          )
          VALUES (?, ?, ?)
          `,
          [guildId, filename, filePath],
        );

        logInfo("tournament", "Tournament export created", {
          guildId,
          eventId,
          eventName: event.name,
          filePath,
        });

        // ==================================================
        // WYŚLIJ ARCHIWUM NA DISCORD
        // ==================================================

        const channel = await interaction.client.channels
          .fetch(archiveChannelId)
          .catch(() => null);

        if (!channel || typeof channel.send !== "function") {
          throw new Error(
            `Nie można znaleźć kanału ARCHIVE (${archiveChannelId})`,
          );
        }

        if (channel.guildId && channel.guildId !== guildId) {
          throw new Error(
            `ARCHIVE_CHANNEL_ID należy do innego serwera (${channel.guildId})`,
          );
        }

        const file = new AttachmentBuilder(filePath, {
          name: filename,
        });

        await channel.send({
          content: `📦 **Archiwum Pick'Em** — ${event.name}`,
          files: [file],
        });

        // ==================================================
        // SPRZĄTANIE — TRANSAKCJA
        // ==================================================

        conn = await pool.getConnection();

        await conn.beginTransaction();

        // ================================================
        // PANELE
        // ================================================

        await conn.query(
          `
          DELETE FROM active_panels
          WHERE guild_id = ?
          `,
          [guildId],
        );

        // ================================================
        // PREDICTIONS
        // ================================================

        await conn.query(
          `
          DELETE FROM swiss_predictions
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM playoffs_predictions
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM doubleelim_predictions
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM playin_predictions
          WHERE guild_id = ?
          `,
          [guildId],
        );

        // ================================================
        // RESULTS
        // ================================================

        await conn.query(
          `
          DELETE FROM swiss_results
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM playoffs_results
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM doubleelim_results
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM playin_results
          WHERE guild_id = ?
          `,
          [guildId],
        );

        // ================================================
        // MATCH POINTS
        // ================================================

        await conn.query(
          `
          DELETE FROM match_points
          WHERE guild_id = ?
          `,
          [guildId],
        );

        // ================================================
        // MAP PREDICTIONS / RESULTS
        // ================================================

        await conn.query(
          `
          DELETE FROM match_map_predictions
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM match_map_results
          WHERE guild_id = ?
          `,
          [guildId],
        );

        // ================================================
        // MATCH PREDICTIONS / RESULTS
        // ================================================

        await conn.query(
          `
          DELETE FROM match_predictions
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM match_results
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM matches
          WHERE guild_id = ?
          `,
          [guildId],
        );

        // ================================================
        // SCORES
        // ================================================

        await conn.query(
          `
          DELETE FROM user_total_scores
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM swiss_scores
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM playoffs_scores
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM doubleelim_scores
          WHERE guild_id = ?
          `,
          [guildId],
        );

        await conn.query(
          `
          DELETE FROM playin_scores
          WHERE guild_id = ?
          `,
          [guildId],
        );

        // ================================================
        // ZAMKNIĘCIE EVENTU
        // ================================================
        //
        // Canonical lifecycle:
        //
        // FINISHED
        // is_open   = 0
        // is_active = 0
        // ================================================

        const [eventUpdate] = await conn.query(
          `
          UPDATE events
          SET
            status = 'FINISHED',
            is_open = 0,
            is_active = 0
          WHERE id = ?
            AND guild_id = ?
          LIMIT 1
          `,
          [eventId, guildId],
        );

        if (eventUpdate.affectedRows !== 1) {
          throw new Error(
            `Nie udało się zakończyć eventu ${eventId} dla guild ${guildId}`,
          );
        }

        // ================================================
        // COMMIT
        // ================================================

        await conn.commit();

        conn.release();
        conn = null;

        // ==================================================
        // AUDIT LOG
        // ==================================================

        await logTournamentAction({
          guildId,

          actorId: interaction.user.id,

          action: "END_TOURNAMENT",

          newValue: {
            eventId,

            eventName: event.name,

            file: filename,

            archiveChannelId,

            at: new Date().toISOString(),
          },
        }).catch((err) =>
          logWarn("tournament", "Audit log failed after tournament end", {
            guildId,
            eventId,

            message: err?.message,

            stack: err?.stack,
          }),
        );

        // ==================================================
        // ODSWIEŻ PANEL ARCHIWUM
        // ==================================================

        await sendArchivePanel(interaction.client, guildId).catch((err) =>
          logWarn("tournament", "Archive panel refresh failed", {
            guildId,

            message: err?.message,
          }),
        );

        // ==================================================
        // POTWIERDZENIE
        // ==================================================

        await interaction.editReply(
          `✅ **Turniej zakończony**\n` +
            `🏆 Event: **${event.name}**\n` +
            `📦 Plik: \`${filename}\`\n` +
            `📁 Kanał: <#${archiveChannelId}>\n` +
            `💾 Lokalnie: \`archiwum/${guildId}/${filename}\``,
        );

        logInfo("tournament", "Tournament finished", {
          guildId,
          eventId,

          eventName: event.name,

          filename,
        });
      } catch (err) {
        logError("tournament", "End tournament failed", {
          guildId,

          message: err?.message,

          stack: err?.stack,
        });

        // ==================================================
        // ROLLBACK
        // ==================================================

        try {
          if (conn) {
            await conn.rollback();
          }
        } catch {}

        try {
          if (conn) {
            conn.release();
          }
        } catch {}

        conn = null;

        await interaction.editReply(
          "❌ Wystąpił błąd podczas kończenia turnieju.",
        );
      } finally {
        ENDING_GUILDS.delete(guildId);
      }
    });
  },
};
