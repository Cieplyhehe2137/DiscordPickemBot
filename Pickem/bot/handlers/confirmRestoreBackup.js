const fs = require('fs');
const path = require('path');
const pool = require('../db');
const logger = require('../utils/logger.js');

module.exports = async function confirmRestoreBackup(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    await interaction.editReply({ content: '🧼 Czyszczenie istniejących danych (bez active_panels)...' });

    const tables = [
      'swiss_predictions', 'swiss_results', 'swiss_scores',
      'playoffs_predictions', 'playoffs_results', 'playoffs_scores',
      'doubleelim_predictions', 'doubleelim_results', 'doubleelim_scores',
      'playin_predictions', 'playin_results', 'playin_scores'
    ];

    for (const table of tables) {
      await pool.query(`DELETE FROM \`${table}\``);
    }

    await interaction.editReply({ content: '📦 Przywracanie danych z backupu...' });

    const backupDir = path.join(__dirname, '../backup');
    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.sql'))
      .map(file => ({ file, time: fs.statSync(path.join(backupDir, file)).mtime }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      return await interaction.editReply({ content: '❌ Brak pliku backupu w katalogu `/backup`' });
    }

    const latestFile = path.join(backupDir, files[0].file);
    const sql = fs.readFileSync(latestFile, 'utf8');

    const statements = sql
      .split(/;\s*[\r\n]+/)
      .filter(stmt =>
        stmt.trim().length > 0 &&
        !stmt.trim().startsWith('--') &&
        !stmt.trim().startsWith('#') &&
        !stmt.includes('CREATE DATABASE') &&
        !stmt.includes('USE `') &&
        !stmt.includes('INSERT INTO `active_panels`') &&
        !stmt.includes('DELETE FROM `active_panels`')
      );

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err) {
        logger.warn(`⚠️ Błąd przy zapytaniu:\n${statement}\n➡️`, err.message);
      }
    }

    await interaction.editReply({
      content: `✅ Backup został pomyślnie przywrócony z pliku \`${files[0].file}\``
    });

  } catch (err) {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    logger.error(`❌ Błąd przywracania backupu przez użytkownika ${username} (${userId}):`, err);
    await interaction.editReply({ content: '❌ Wystąpił błąd podczas przywracania backupu.' });
  }
};
