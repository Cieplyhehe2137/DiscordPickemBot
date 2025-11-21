const fs = require('fs');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const path = require('path');

module.exports = async (interaction) => {
  const files = fs.readdirSync(path.join(__dirname, '../backup')).filter(f => f.endsWith('.sql'));

  if (files.length === 0) {
    return interaction.reply({ content: '❌ Brak plików backupu w folderze `/backup`.', ephemeral: true });
  }

  const options = files.map(file => ({
    label: file,
    value: file,
  })).slice(-25); // Discord limit

  const select = new StringSelectMenuBuilder()
    .setCustomId('confirm_restore_backup')
    .setPlaceholder('🗂 Wybierz plik backupu...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);

  await interaction.reply({
    content: '🧩 Wybierz plik backupu do przywrócenia:',
    components: [row],
    ephemeral: true,
  });
};
