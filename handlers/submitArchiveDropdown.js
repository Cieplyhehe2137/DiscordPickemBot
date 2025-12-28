const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger.js');

module.exports = async (interaction) => {
  const selected = interaction.values?.[0]; // np. "STARLADDER_BUDAPEST_MAJOR_2025.xlsx"

  // jeżeli select byłby kiedyś "martwy" (np. __none__), to tylko zamykamy interakcję
  if (!selected || selected === '__none__') {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }
    return;
  }

  // minimalna walidacja: value ma być nazwą pliku, bez ścieżek
  const safeName = path.basename(selected);
  if (safeName !== selected) {
    return interaction.reply({
      content: '❌ Nieprawidłowa nazwa pliku.',
      ephemeral: true
    });
  }

  const archivePath = path.join(__dirname, '..', 'archiwum', safeName);

  try {
    // ważne: przy większych plikach lepiej deferReply, żeby Discord nie wywalił timeoutu
    await interaction.deferReply({ ephemeral: true });

    if (!fs.existsSync(archivePath)) {
      return interaction.editReply({
        content: `❌ Plik \`${safeName}\` nie istnieje w archiwum.`
      });
    }

    await interaction.editReply({
      content: `📥 Oto plik archiwum: **${safeName}**`,
      files: [{ attachment: archivePath, name: safeName }]
    });
  } catch (err) {
    const userId = interaction.user?.id;
    const username = interaction.user?.username;
    logger.error("archive", "Send archive file failed", {
      userId,
      username,
      selected: safeName,
      message: err.message,
      stack: err.stack
    });

    // spróbuj odpowiedzieć w sposób bezpieczny
    if (interaction.deferred || interaction.replied) {
      try {
        await interaction.editReply({ content: '❌ Wystąpił błąd podczas wysyłania pliku.' });
      } catch (_) {}
    } else {
      try {
        await interaction.reply({ content: '❌ Wystąpił błąd podczas wysyłania pliku.', ephemeral: true });
      } catch (_) {}
    }
  }
};
