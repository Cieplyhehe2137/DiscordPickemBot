const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const exportClassification = require('../handlers/exportClassification');
const sendArchivePanel = require('../utils/sendArchivePanel');

const pool = require('../db');
const { withGuild } = require('../utils/guildContext');
const { getGuildConfig } = require('../utils/guildRegistry');

const logger = require('../logger');

// blokada per guild (żeby /end_tournament na 1 serwerze nie blokował drugiego)
const ENDING_GUILDS = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('end_tournament')
    .setDescription('Zamyka turniej Pick\'Em, eksportuje dane i tworzy archiwum')
    .addStringOption(option =>
      option.setName('nazwa_pliku')
        .setDescription('Nazwa pliku archiwum (bez .xlsx)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    if (!guildId) return interaction.editReply('❌ Ta komenda działa tylko na serwerze (nie w DM).');

    // blokada per guild
    if (ENDING_GUILDS.has(guildId)) {
      return interaction.editReply('⏳ Ta operacja już trwa na tym serwerze – poczekaj na zakończenie.');
    }

    return withGuild(guildId, async () => {
      let conn = null;

      try {
        ENDING_GUILDS.add(guildId);

        const cfg = getGuildConfig(guildId);
        const archiveChannelId = cfg?.ARCHIVE_CHANNEL_ID;

        if (!archiveChannelId) {
          return interaction.editReply('❌ Brak ARCHIVE_CHANNEL_ID w konfiguracji dla tego serwera.');
        }

        // 📁 nazwa i ścieżka (PER GUILD)
        const rawName = interaction.options.getString('nazwa_pliku') || '';
        const customName = rawName.trim();
        if (!customName) {
          return interaction.editReply('❌ Podaj poprawną nazwę pliku.');
        }

        const safeName = customName.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const filename = `${safeName}.xlsx`;

        const archiveDir = path.join(__dirname, '..', 'archiwum', String(guildId)); // ✅ per guild
        const filePath = path.join(archiveDir, filename);

        fs.mkdirSync(archiveDir, { recursive: true });

        // 🔒 zamknij panele (UI wie, że koniec) — w DB tego guilda
        await pool.query(`UPDATE active_panels SET closed = 1`);

        // 📤 1) EKSPORT do pliku (w kontekście DB tego guilda)
        await exportClassification(null, filePath);
        logger.info(`[end_tournament] zapisano plik: ${filePath} (guild=${guildId})`);

        // 📡 2) WYŚLIJ PLIK NA KANAŁ ARCHIWUM (PER GUILD)
        const channel = await interaction.client.channels.fetch(archiveChannelId).catch(() => null);
        if (!channel || !channel.send) {
          throw new Error(`Nie mogę znaleźć kanału o ID ${archiveChannelId}`);
        }

        // guard: kanał musi należeć do tego guilda
        if (channel.guildId && channel.guildId !== guildId) {
          throw new Error(`ARCHIVE_CHANNEL_ID jest błędny: kanał należy do innego serwera (channel.guildId=${channel.guildId}).`);
        }

        const stats = fs.statSync(filePath);
        if (stats.size > 25 * 1024 * 1024) {
          logger.warn(`[end_tournament] Plik >25MB (${stats.size} bytes) — Discord może nie przyjąć.`);
        }

        const file = new AttachmentBuilder(filePath, { name: filename });

        await channel.send({
          content: `📦 **Archiwum Pick'Em** – zapis turnieju: \`${filename}\``,
          files: [file]
        });

        // 🧹 3) SPRZĄTANIE PO EKSPORCIE — prawdziwa transakcja na jednym połączeniu
        conn = await pool.getConnection();
        await conn.beginTransaction();

        await conn.query(`DELETE FROM active_panels`);

        await conn.query(`DELETE FROM swiss_predictions`);
        await conn.query(`DELETE FROM playoffs_predictions`);
        await conn.query(`DELETE FROM doubleelim_predictions`);
        await conn.query(`DELETE FROM playin_predictions`);

        await conn.query(`DELETE FROM swiss_results`);
        await conn.query(`DELETE FROM playoffs_results`);
        await conn.query(`DELETE FROM doubleelim_results`);
        await conn.query(`DELETE FROM playin_results`);

        await conn.query(`DELETE FROM swiss_scores`);
        await conn.query(`DELETE FROM playoffs_scores`);
        await conn.query(`DELETE FROM doubleelim_scores`);
        await conn.query(`DELETE FROM playin_scores`);

        await conn.commit();
        conn.release();
        conn = null;

        // 🔁 4) Odśwież panel archiwum (PER GUILD)
        await sendArchivePanel(interaction.client, guildId).catch(err =>
          logger.warn('[end_tournament] Nie udało się odświeżyć panelu archiwum', { guildId, message: err?.message })
        );

        // ✅ 5) Potwierdzenie
        await interaction.editReply(
          `✅ Turniej zakończony.\n` +
          `• Plik: \`${filename}\`\n` +
          `• Kanał: <#${archiveChannelId}>\n` +
          `• Zapis lokalny: \`archiwum/${guildId}/${filename}\``
        );

      } catch (err) {
        logger.error('[end_tournament] error', { guildId, message: err?.message, stack: err?.stack });

        // rollback jeśli transakcja już ruszyła
        try { if (conn) await conn.rollback(); } catch {}
        try { if (conn) conn.release(); } catch {}

        await interaction.editReply('❌ Wystąpił błąd przy kończeniu turnieju.');
      } finally {
        ENDING_GUILDS.delete(guildId);
      }
    });
  }
};
