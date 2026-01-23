// handlers/submitArchiveDropdown.js
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger.js');

const BASE_ARCHIVE_DIR = path.join(__dirname, '..', 'archiwum');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = async (interaction) => {
  const selected = interaction.values?.[0];
  const guildId = interaction.guildId;

  // martwy / pusty select
  if (!selected || selected === '__none__') {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }
    return;
  }

  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta funkcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

  // zabezpieczenie przed ../
  const safeName = path.basename(String(selected));
  if (safeName !== selected) {
    return interaction.reply({
      content: '❌ Nieprawidłowa nazwa pliku.',
      ephemeral: true
    });
  }

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    // upewnij się, że katalog istnieje
    ensureDir(BASE_ARCHIVE_DIR);

    const guildArchiveDir = path.join(BASE_ARCHIVE_DIR, String(guildId));
    ensureDir(guildArchiveDir);

    const archivePath = path.join(guildArchiveDir, safeName);

    if (!fs.existsSync(archivePath)) {
      return interaction.editReply({
        content: `❌ Plik \`${safeName}\` nie istnieje w archiwum tego serwera.`
      });
    }

    return interaction.editReply({
      content: `📥 Oto plik archiwum: **${safeName}**`,
      files: [{ attachment: archivePath, name: safeName }]
    });

  } catch (err) {
    logger.error('archive', 'Send archive file failed', {
      guildId,
      userId: interaction.user?.id,
      username: interaction.user?.username,
      selected: safeName,
      message: err.message,
      stack: err.stack
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: '❌ Wystąpił błąd podczas wysyłania pliku.'
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas wysyłania pliku.',
        ephemeral: true
      }).catch(() => {});
    }
  }
};
