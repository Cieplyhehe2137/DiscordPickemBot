// handlers/archiveSelect.js
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'archive_select') return;

  const guildId = interaction.guildId || 'dm';
  const picked = interaction.values?.[0];

  if (!picked || picked === '__none__') {
    await interaction.deferUpdate().catch(() => {});
    return interaction.followUp({ ephemeral: true, content: 'Brak plików archiwum.' });
  }

  // ✅ zabezpieczenie przed path traversal (../../)
  const filename = path.basename(String(picked));
  if (filename !== picked) {
    await interaction.deferUpdate().catch(() => {});
    return interaction.followUp({ ephemeral: true, content: '❌ Niepoprawna nazwa pliku.' });
  }

  const archiveDir = path.join(__dirname, '..', 'archiwum', String(guildId));
  const filePath = path.join(archiveDir, filename);

  if (!fs.existsSync(filePath)) {
    logger.warn('[archive_select] file not found', { guildId, filename, filePath });
    await interaction.deferUpdate().catch(() => {});
    return interaction.followUp({ ephemeral: true, content: '❌ Nie znaleziono pliku na serwerze.' });
  }

  await interaction.deferUpdate().catch(() => {});
  return interaction.followUp({
    ephemeral: true,
    content: `📄 Oto plik: \`${filename}\``,
    files: [filePath]
  });
};
