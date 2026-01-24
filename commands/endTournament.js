const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const exportClassification = require('../handlers/exportClassification');
const sendArchivePanel = require('../utils/sendArchivePanel');

const { withGuild } = require('../utils/guildContext');
const { getGuildConfig } = require('../utils/guildRegistry');

const logger = require('../logger');

// blokada per guild (żeby /end_tournament na 1 serwerze nie blokował drugiego)
const ENDING_GUILDS = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('end_tournament')
    .setDescription('Zamyka turniej: archiwizuje klasyfikację i czyści dane (per guild)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('nazwa')
        .setDescription('Nazwa pliku .xlsx (bez rozszerzenia)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({ ephemeral: true, content: '❌ Komenda działa tylko na serwerze.' });
    }

    if (ENDING_GUILDS.has(guildId)) {
      return interaction.reply({ ephemeral: true, content: '⏳ Ten serwer już kończy turniej — spróbuj za chwilę.' });
    }

    const cfg = getGuildConfig(guildId) || {};
    const archiveChannelId = cfg.ARCHIVE_CHANNEL_ID || process.env.ARCHIVE_CHANNEL_ID;

    if (!archiveChannelId) {
      return interaction.reply({
        ephemeral: true,
        content: '❌ Brak ARCHIVE_CHANNEL_ID w konfiguracji tego serwera.'
      });
    }

    const customName = interaction.options.getString('nazwa')?.trim();
    if (!customName) {
      return interaction.reply({ ephemeral: true, content: '❌ Podaj poprawną nazwę pliku.' });
    }

    await interaction.deferReply({ ephemeral: true });

    return withGuild(guildId, async (pool) => {
      let conn = null;

      try {
        ENDING_GUILDS.add(guildId);

        const safeName = customName.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const filename = `${safeName}.xlsx`;

        const archiveDir = path.join(__dirname, '..', 'archiwum', String(guildId)); // ✅ per guild
        const filePath = path.join(archiveDir, filename);

        fs.mkdirSync(archiveDir, { recursive: true });

        // 🔒 zamknij panele (per guild)
        await pool.query(
          `UPDATE active_panels
           SET active = 0, closed = 1, closed_at = NOW()
           WHERE guild_id = ?`,
          [guildId]
        );

        // 📤 1) EKSPORT do pliku
        await exportClassification(interaction, filePath);
        logger.info(`[end_tournament] zapisano plik: ${filePath} (guild=${guildId})`);

        // 📡 2) WYŚLIJ PLIK NA KANAŁ ARCHIWUM
        const channel = await interaction.client.channels.fetch(archiveChannelId).catch(() => null);
        if (!channel || !channel.send) {
          throw new Error(`Nie mogę znaleźć kanału o ID ${archiveChannelId}`);
        }

        const attachment = new AttachmentBuilder(filePath);
        await channel.send({ content: `📦 Archiwum turnieju: **${safeName}**`, files: [attachment] });

        // 🧹 3) RESET DB — UWAGA: PER GUILD
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

        await conn.query(`DELETE FROM swiss_scores WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM playoffs_scores WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM doubleelim_scores WHERE guild_id = ?`, [guildId]);
        await conn.query(`DELETE FROM playin_scores WHERE guild_id = ?`, [guildId]);

        await conn.commit();

        // 🎛️ 4) panel archiwum / start nowego
        await sendArchivePanel(interaction.client, guildId);

        await interaction.editReply(`✅ Turniej zakończony. Plik wysłany na kanał archiwum i dane wyczyszczone (guild=${guildId}).`);

      } catch (err) {
        if (conn) {
          try { await conn.rollback(); } catch (_) {}
        }
        console.error('[end_tournament] Error:', err);
        return interaction.editReply(`❌ Błąd: ${err.message}`);
      } finally {
        if (conn) conn.release();
        ENDING_GUILDS.delete(guildId);
      }
    });
  }
};
