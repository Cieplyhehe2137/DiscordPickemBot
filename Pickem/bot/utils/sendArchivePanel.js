const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const ARCHIVE_CHANNEL_ID = process.env.ARCHIVE_CHANNEL_ID || '1395138750710808586';
const ARCHIVE_DIR = path.join(__dirname, '..', 'archiwum');

function safeLabel(str) {
  // Discord limit: 1–100 chars
  if (!str) return 'plik';
  return str.length > 100 ? str.slice(0, 97) + '…' : str;
}

// 🧩 Zbuduj embed + dropdown
function buildArchiveMessage() {
  let files = [];
  if (fs.existsSync(ARCHIVE_DIR)) {
    // tylko .xlsx, posortowane od najnowszych
    files = fs.readdirSync(ARCHIVE_DIR)
      .filter(n => n.toLowerCase().endsWith('.xlsx'))
      .map(name => ({ name, mtime: fs.statSync(path.join(ARCHIVE_DIR, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .map(x => x.name);
  }

  const embed = new EmbedBuilder()
    .setTitle('📂 Archiwum Pick\'Em')
    .setDescription(
      files.length
        ? 'Wybierz jeden z zakończonych turniejów, aby pobrać plik z wynikami.'
        : 'Brak zakończonych turniejów. Gdy archiwum zostanie uzupełnione, pliki pojawią się tutaj.'
    )
    .setColor(0x5865F2)
    .setTimestamp(new Date());

  // Musi być 1–25 opcji. Gdy brak plików – dodajemy „martwą” opcję i wyłączamy select.
  const hasFiles = files.length > 0;
  const options = hasFiles
    ? files.slice(0, 25).map(name => ({
        label: safeLabel(name),
        value: name,
      }))
    : [{
        label: 'Brak plików archiwum',
        value: '__none__',
        description: 'Pliki pojawią się po zakończeniu turnieju.',
      }];

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('archive_select')
      .setPlaceholder(hasFiles ? 'Wybierz plik archiwum...' : 'Brak plików archiwum')
      .setDisabled(!hasFiles)
      .addOptions(options)
  );

  return { embed, components: [row] };
}

// 📤 Utwórz/edytuj pojedynczy panel
module.exports = async function sendArchivePanel(client) {
  const channel = await client.channels.fetch(ARCHIVE_CHANNEL_ID);
  if (!channel || !channel.isTextBased?.()) {
    throw new Error(`Kanał o ID ${ARCHIVE_CHANNEL_ID} nie jest tekstowy lub nie istnieje.`);
  }

  const { embed, components } = buildArchiveMessage();

  // Znajdź istniejący panel (ostatnia wiadomość bota z tytułem Archiwum Pick'Em)
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  let panelMessage = null;

  if (messages) {
    const botId = client.user.id;
    panelMessage = messages
      .filter(m => m.author?.id === botId && m.embeds?.length)
      .find(m => (m.embeds[0].title || '').includes('Archiwum Pick\'Em')) || null;
  }

  if (panelMessage) {
    await panelMessage.edit({ embeds: [embed], components });
    console.log('✅ Zaktualizowano panel archiwum.');
  } else {
    const newMsg = await channel.send({ embeds: [embed], components });
    console.log('🆕 Utworzono panel archiwum.');
    // opcjonalnie:
    // await newMsg.pin().catch(() => {});
  }
};
