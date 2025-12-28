const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const exportClassification = require('../handlers/exportClassification');
const sendArchivePanel = require('../utils/sendArchivePanel');
const pool = require('../db');

let IS_ENDING = false;

const ARCHIVE_CHANNEL_ID = process.env.ARCHIVE_CHANNEL_ID || '1395135703108550708';

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

    if (IS_ENDING) {
      return interaction.editReply('⏳ Ta operacja już trwa – poczekaj na zakończenie.');
    }

    try {
      IS_ENDING = true;

      // 📁 nazwa i ścieżka
      const rawName = interaction.options.getString('nazwa_pliku') || '';
      const customName = rawName.trim();
      if (!customName) {
        return interaction.editReply('❌ Podaj poprawną nazwę pliku.');
      }

      const safeName = customName.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `${safeName}.xlsx`;
      const archiveDir = path.join(__dirname, '..', 'archiwum');
      const filePath = path.join(archiveDir, filename);

      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

      // 🔒 zamknij panele (UI wie, że koniec)
      await pool.query(`UPDATE active_panels SET closed = 1`);

      // 📤 1) EKSPORT do pliku
      await exportClassification(null, filePath);
      console.log(`✅ Zapisano archiwalny plik: ${filePath}`);

      // 📡 2) WYŚLIJ PLIK NA KANAŁ ARCHIWUM
      const channel = await interaction.client.channels.fetch(ARCHIVE_CHANNEL_ID);
      if (!channel || !channel.send) {
        throw new Error(`Nie mogę znaleźć kanału o ID ${ARCHIVE_CHANNEL_ID}`);
      }

      // Uwaga: Discord limit ~25MB dla załączników (jeśli serwer nie ma wyższego)
      const stats = fs.statSync(filePath);
      if (stats.size > 25 * 1024 * 1024) {
        console.warn('⚠️ Plik >25MB – może nie wysłać się na standardowych ustawieniach Discord.');
      }

      const file = new AttachmentBuilder(filePath, { name: filename });

      await channel.send({
        content: `📦 **Archiwum Pick'Em** – zapis turnieju: \`${filename}\``,
        files: [file]
        // (opcjonalnie możesz dodać własny embed tutaj, ale masz już stały panel archiwum)
      });

      // 🧹 3) SPRZĄTANIE PO EKSPORCIE (RESET NA NOWY TURNIEJ) – w transakcji
      await pool.query('START TRANSACTION');

      await pool.query(`DELETE FROM active_panels`);

      await pool.query(`DELETE FROM swiss_predictions`);
      await pool.query(`DELETE FROM playoffs_predictions`);
      await pool.query(`DELETE FROM doubleelim_predictions`);
      await pool.query(`DELETE FROM playin_predictions`);

      await pool.query(`DELETE FROM swiss_results`);
      await pool.query(`DELETE FROM playoffs_results`);
      await pool.query(`DELETE FROM doubleelim_results`);
      await pool.query(`DELETE FROM playin_results`);

      await pool.query(`DELETE FROM swiss_scores`);
      await pool.query(`DELETE FROM playoffs_scores`);
      await pool.query(`DELETE FROM doubleelim_scores`);
      await pool.query(`DELETE FROM playin_scores`);

      await pool.query('COMMIT');

      // 🔁 4) Odśwież stały panel archiwum (dropdown/embed jak na screenie)
      await sendArchivePanel(interaction.client).catch(err =>
        console.warn('⚠️ Nie udało się odświeżyć panelu archiwum:', err)
      );

      // ✅ 5) Potwierdzenie
      await interaction.editReply(`✅ Turniej zakończony. Plik \`${filename}\` wysłany na kanał <#${ARCHIVE_CHANNEL_ID}> i zapisany lokalnie.`);

    } catch (err) {
      console.error('❌ Błąd podczas kończenia turnieju:', err);
      try { await pool.query('ROLLBACK'); } catch {}
      await interaction.editReply('❌ Wystąpił błąd przy kończeniu turnieju.');
    } finally {
      IS_ENDING = false;
    }
  }
};
