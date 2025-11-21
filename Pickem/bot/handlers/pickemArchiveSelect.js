// handlers/pickemArchiveSelect.js
const path = require('path');
const fs = require('fs');
const logger = require('../logger');

module.exports = async (interaction) => {
  try {
    if (!interaction.isStringSelectMenu()) return;

    const filename = interaction.values[0]; // np. TEST1234.xlsx
    const archiveDir = path.join(__dirname, '..', 'archiwum');
    const filePath = path.join(archiveDir, filename);

    if (!fs.existsSync(filePath)) {
      logger.warn(`[Archiwum] Plik nie istnieje: ${filePath}`);
      return interaction.reply({
        content: `❌ Nie znaleziono pliku **${filename}** w katalogu archiwum.`,
        ephemeral: true,
      });
    }

    logger.info(`[Archiwum] ${interaction.user.username} pobiera plik: ${filename}`);

    await interaction.reply({
      content: `📂 Oto plik **${filename}**:`,
      files: [filePath],
      ephemeral: true, // albo false, jeśli ma być publicznie
    });
  } catch (err) {
    logger.error('[Archiwum] Błąd przy wysyłaniu pliku:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas wysyłania pliku z archiwum.',
        ephemeral: true,
      });
    }
  }
};
