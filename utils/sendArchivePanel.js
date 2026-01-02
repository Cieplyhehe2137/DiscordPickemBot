// utils/sendArchivePanel.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const logger = require('../logger'); // jeśli logger w root (tak jak u Ciebie)
const { getGuildConfig } = require('./guildRegistry'); // ✅ konfiguracja per guild

const PANEL_TITLE = "📂 Archiwum Pick'Em";
const BASE_ARCHIVE_DIR = path.join(__dirname, '..', 'archiwum'); // baza, a nie wspólny folder z plikami

function safeLabel(str) {
  if (!str) return 'plik';
  const s = String(str);
  return s.length > 100 ? s.slice(0, 97) + '…' : s;
}

// 🧩 Zbuduj embed + dropdown (dla konkretnego folderu guild)
function buildArchiveMessage(archiveDir) {
  let files = [];

  // upewnij się, że folder istnieje (bez crasha)
  try {
    fs.mkdirSync(archiveDir, { recursive: true });
  } catch (_) {}

  if (fs.existsSync(archiveDir)) {
    files = fs.readdirSync(archiveDir)
      .filter(n => n.toLowerCase().endsWith('.xlsx'))
      .map(name => ({ name, mtime: fs.statSync(path.join(archiveDir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .map(x => x.name);
  }

  const embed = new EmbedBuilder()
    .setTitle(PANEL_TITLE)
    .setDescription(
      files.length
        ? 'Wybierz jeden z zakończonych turniejów, aby pobrać plik z wynikami.'
        : 'Brak zakończonych turniejów. Gdy archiwum zostanie uzupełnione, pliki pojawią się tutaj.'
    )
    .setColor(0x5865F2)
    .setTimestamp(new Date());

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

// 📤 Utwórz/edytuj pojedynczy panel (PER GUILD)
module.exports = async function sendArchivePanel(client, guildId) {
  const cfg = getGuildConfig(guildId);
  const channelId = cfg?.ARCHIVE_CHANNEL_ID;

  if (!channelId) {
    logger.warn('archive', 'ARCHIVE_CHANNEL_ID missing for guild', { guildId });
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased?.()) {
    logger.error('archive', 'Archive channel missing or not text-based', { guildId, channelId });
    return;
  }

  // ✅ Guard: kanał musi należeć do tego guilda (chroni przed złym env)
  if (channel.guildId && channel.guildId !== guildId) {
    logger.error('archive', 'Archive channel belongs to different guild (misconfigured)', {
      guildId,
      channelId,
      channelGuildId: channel.guildId
    });
    return;
  }

  // ✅ Folder archiwum per guild
  const archiveDir = path.join(BASE_ARCHIVE_DIR, String(guildId));

  const { embed, components } = buildArchiveMessage(archiveDir);

  // Znajdź istniejący panel (ostatnia wiadomość bota z naszym tytułem)
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  let panelMessage = null;

  if (messages) {
    const botId = client.user.id;
    panelMessage = messages
      .filter(m => m.author?.id === botId && m.embeds?.length)
      .find(m => (m.embeds[0].title || '') === PANEL_TITLE) || null;
  }

  if (panelMessage) {
    await panelMessage.edit({ embeds: [embed], components });
    logger.info('archive', 'Archive panel updated', { guildId, channelId, messageId: panelMessage.id });
  } else {
    const newMsg = await channel.send({ embeds: [embed], components });
    logger.info('archive', 'Archive panel sent', { guildId, channelId, messageId: newMsg.id });
  }
};
