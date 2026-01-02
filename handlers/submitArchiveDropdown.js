// handlers/submitArchiveDropdown.js
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger.js');

const BASE_ARCHIVE_DIR = path.join(__dirname, '..', 'archiwum');

module.exports = async (interaction) => {
  const selected = interaction.values?.[0]; // np. "STARLADDER_BUDAPEST_MAJOR_2025.xlsx"
  const guildId = interaction.guildId;

  // jeżeli select byłby "martwy"
  if (!selected || selected === '__none__') {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate().catch(() => {});
    }
    return;
  }

  // to działa tylko na serwerze (panel jest na kanale, ale guard zostawiamy)
  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta funkcja działa tylko na serwerze (nie w DM).',
      ephemeral: true
    });
  }

  // minimalna walidacja: value ma być nazwą pliku, bez ścieżek
  const safeName = path.basename(String(selected));
  if (safeName !== selected) {
    return interaction.reply({
      content: '❌ Nieprawidłowa nazwa pliku.',
      ephemeral: true
    });
  }

  // ✅ per-guild folder
  const archivePath = path.join(BASE_ARCHIVE_DIR, String(guildId), safeName);

  try {
    await interaction.deferReply({ ephemeral: true });

    if (!fs.existsSync(archivePath)) {
      return interaction.editReply({
        content: `❌ Plik \`${safeName}\` nie istnieje w archiwum tego serwera.`
      });
    }

    await interaction.editReply({
      content: `📥 Oto plik archiwum: **${safeName}**`,
      files: [{ attachment: archivePath, name: safeName }]
    });
  } catch (err) {
    logger.error("archive", "Send archive file failed", {
      guildId,
      userId: interaction.user?.id,
      username: interaction.user?.username,
      selected: safeName,
      message: err.message,
      stack: err.stack
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: '❌ Wystąpił błąd podczas wysyłania pliku.' }).catch(() => {});
    } else {
      await interaction.reply({ content: '❌ Wystąpił błąd podczas wysyłania pliku.', ephemeral: true }).catch(() => {});
    }
  }
};
