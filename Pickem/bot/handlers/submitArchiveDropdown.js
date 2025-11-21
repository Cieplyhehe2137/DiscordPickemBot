const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger.js');

module.exports = async (interaction) => {
  const selected = interaction.values[0]; // np. "iem_cologne_2025.xlsx"
  const archivePath = path.join(__dirname, '..', 'archiwum', selected);

  if (!fs.existsSync(archivePath)) {
    return interaction.reply({
      content: `❌ Plik \`${selected}\` nie istnieje w archiwum.`,
      ephemeral: true
    });
  }

  try {
    await interaction.reply({
      content: `📥 Oto plik archiwum: \`${selected}\``,
      files: [{ attachment: archivePath, name: selected }],
      ephemeral: true
    });
  } catch (err) {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    logger.error(`❌ Błąd przy wysyłaniu pliku archiwum dla użytkownika ${username} (${userId}):`, err);
    await interaction.reply({
      content: '❌ Wystąpił błąd podczas wysyłania pliku.',
      ephemeral: true
    });
  }
};
