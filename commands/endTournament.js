const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const { logInfo, logWarn, logError } = require('../utils/logger');

const exportClassification = require('../handlers/exportClassification');
const sendArchivePanel = require('../utils/sendArchivePanel');
const { withGuild } = require('../utils/guildContext');
const { getGuildConfig } = require('../utils/guildRegistry');
const { logTournamentAction } = require('../utils/logTournamentAction');

// blokada per guild (żeby nie odpalić 2x równolegle)
const ENDING_GUILDS = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('end_tournament')
    .setDescription('Zamyka turniej Pick\'Em, eksportuje dane i tworzy archiwum')
    .addStringOption(option =>
      option
        .setName('nazwa_pliku')
        .setDescription('Nazwa pliku archiwum (bez .xlsx)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.editReply(
        '❌ Ta komenda działa tylko na serwerze (nie w DM).'
      );
    }

    if (ENDING_GUILDS.has(guildId)) {
      return interaction.editReply(
        '⏳ Operacja kończenia turnieju już trwa na tym serwerze.'
      );
    }

    return withGuild({ guildId }, async ({ pool }) => {
      let conn = null;

      try {
        ENDING_GUILDS.add(guildId);

        const cfg = getGuildConfig(guildId);
        const archiveChannelId = cfg?.ARCHIVE_CHANNEL_ID;

        if (!archiveChannelId) {
          return interaction.editReply(
            '❌ Brak `ARCHIVE_CHANNEL_ID` w konfiguracji tego serwera.'
          );
        }

        // ===== NAZWA PLIKU =====
        const rawName = interaction.options.getString('nazwa_pliku') || '';
        const safeBase = rawName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');

        if (!safeBase) {
          return interaction.editReply('❌ Podaj poprawną nazwę pliku.');
        }

        const filename = `${safeBase}.xlsx`;

        // ===== ŚCIEŻKA (PER GUILD) =====
        const archiveDir = path.join(
          __dirname,
          '..',
          'archiwum',
          String(guildId)
        );
        const filePath = path.join(archiveDir, filename);
        fs.mkdirSync(archiveDir, { recursive: true });

        // ===== UI: zamknij panele tylko tego guilda =====
        await pool.query(
          `UPDATE active_panels
           SET closed = 1, closed_at = NOW()
           WHERE guild_id = ? AND closed = 0`,
          [guildId]
        );

        // ===== EKSPORT (POPRAWNE WYWOŁANIE) =====
        await exportClassification({
          guildId,
          outputPath: filePath,
        });

        await pool.query(
          `INSERT INTO archive_files (guild_id, filename, path)
   VALUES (?, ?, ?)`,
          [
            guildId,
            filename,
            filePath
          ]
        );

        logInfo('[end_tournament] export ok', {
          guildId,
          filePath,
        });

        // ===== WYŚLIJ NA KANAŁ ARCHIWUM =====
        const channel = await interaction.client.channels
          .fetch(archiveChannelId)
          .catch(() => null);

        if (!channel || !channel.send) {
          throw new Error(
            `Nie można znaleźć kanału ARCHIVE (${archiveChannelId})`
          );
        }

        if (channel.guildId && channel.guildId !== guildId) {
          throw new Error(
            `ARCHIVE_CHANNEL_ID należy do innego serwera (${channel.guildId})`
          );
        }

        const file = new AttachmentBuilder(filePath, { name: filename });

        await channel.send({
          content: `📦 **Archiwum Pick'Em** — zapis turnieju`,
          files: [file],
        });

        // ===== SPRZĄTANIE (TRANSAKCJA) =====
        conn = await pool.getConnection();
        await conn.beginTransaction();

        await conn.query(`DELETE FROM active_panels WHERE guild_id = ?`, [guildId]);

        await conn.query(`DELETE FROM swiss_predictions WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM playoffs_predictions WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM doubleelim_predictions WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM playin_predictions WHERE guild_id = ?`, [guildId]);

        await conn.query(`DELETE FROM swiss_results WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM playoffs_results WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM doubleelim_results WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM playin_results WHERE guild_id = ?`, [guildId]);

        await conn.query(`DELETE FROM match_points WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM match_map_predictions WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM match_map_results WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM match_predictions WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM match_results WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM matches WHERE guild_id = ?`, [guildId]);

        await conn.query(`DELETE FROM user_total_scores WHERE guild_id = ?`, [guildId]);

        await conn.query(`DELETE FROM swiss_scores WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM playoffs_scores WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM doubleelim_scores WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM playin_scores WHERE guild_id = ?`, [guildId]);

        await conn.commit();
        conn.release();
        conn = null;

        // ===== AUDIT LOG =====
        await logTournamentAction({
          guildId,
          actorId: interaction.user.id,
          action: 'END_TOURNAMENT',
          newValue: {
            file: filename,
            archiveChannelId,
            at: new Date().toISOString(),
          },
        });

        // ===== ODSWIEŻ ARCHIWUM PANEL =====
        await sendArchivePanel(interaction.client, guildId).catch(err =>
          logWarn('[end_tournament] archive panel refresh failed', {
            guildId,
            message: err?.message,
          })
        );

        // ===== POTWIERDZENIE =====
        await interaction.editReply(
          `✅ **Turniej zakończony**\n` +
          `• Plik: \`${filename}\`\n` +
          `• Kanał: <#${archiveChannelId}>\n` +
          `• Lokalnie: \`archiwum/${guildId}/${filename}\``
        );
      } catch (err) {
        logError('[end_tournament] error', {
          guildId,
          message: err?.message,
          stack: err?.stack,
        });

        try { if (conn) await conn.rollback(); } catch { }
        try { if (conn) conn.release(); } catch { }

        await interaction.editReply(
          '❌ Wystąpił błąd podczas kończenia turnieju.'
        );
      } finally {
        ENDING_GUILDS.delete(guildId);
      }
    });
  },
};
