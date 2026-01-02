// utils/sendArchivePanel.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const logger = require('./logger'); // ✅ wrapper loggera (scope, msg, data)
const { getGuildConfig, getGuildPaths, ensureGuildDirs } = require('./guildRegistry');

const PANEL_TITLE = "📂 Archiwum Pick'Em";

function safeLabel(str) {
  if (!str) return 'plik';
  const s = String(str);
  return s.length > 100 ? s.slice(0, 97) + '…' : s;
}

// 🧩 Zbuduj embed + dropdown dla konkretnego guildId
function buildArchiveMessage(archiveDir) {
  let files = [];

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

  // Discord: max 25 opcji w select
  const options = hasFiles
    ? files.slice(0, 25).map(name => ({
        label: safeLabel(name),
        value: name, // UWAGA: value też ma limit 100 znaków – nazwy plików trzymaj krótkie
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

async function findExistingPanelMessage(channel, clientUserId) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });

    const found = messages
      .filter(m => m.author?.id === clientUserId)
      .find(m => {
        const e = m.embeds?.[0];
        return e && e.title === PANEL_TITLE;
      });

    return found || null;
  } catch (err) {
    logger.error('archive', 'Failed to fetch messages for archive panel lookup', {
      message: err.message,
      stack: err.stack,
    });
    return null;
  }
}

// 📤 Utwórz/edytuj panel archiwum per guild
module.exports = async function sendArchivePanel(client, guildId) {
  const gid = guildId || process.env.GUILD_ID;
  if (!gid) {
    logger.error('archive', 'sendArchivePanel called without guildId', {});
    return;
  }

  const cfg = getGuildConfig(gid);
  if (!cfg) {
    logger.error('archive', 'Missing guild config for sendArchivePanel', { guildId: gid });
    return;
  }

  const channelId = String(cfg.ARCHIVE_CHANNEL_ID || '').trim();
  if (!channelId) {
    logger.error('archive', 'Missing ARCHIVE_CHANNEL_ID in guild config', { guildId: gid });
    return;
  }

  try {
    ensureGuildDirs(gid);
    const { archiveDir } = getGuildPaths(gid);

    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased?.()) {
      logger.error('archive', 'Archive channel not found or not text-based', { guildId: gid, channelId });
      return;
    }

    // ✅ Guard: kanał musi należeć do tego guilda
    if (channel.guildId && String(channel.guildId) !== String(gid)) {
      logger.error('archive', 'ARCHIVE_CHANNEL_ID points to a channel in another guild', {
        guildId: gid,
        channelId,
        channelGuildId: channel.guildId,
      });
      return;
    }

    const { embed, components } = buildArchiveMessage(archiveDir);
    const existing = await findExistingPanelMessage(channel, client.user.id);

    if (existing) {
      await existing.edit({ embeds: [embed], components });
      logger.info('archive', 'Archive panel updated', { guildId: gid, channelId, messageId: existing.id });
      return;
    }

    const sent = await channel.send({ embeds: [embed], components });
    logger.info('archive', 'Archive panel sent', { guildId: gid, channelId, messageId: sent.id });
  } catch (err) {
    logger.error('archive', 'sendArchivePanel failed', {
      guildId: gid,
      channelId,
      message: err.message,
      stack: err.stack,
    });
  }
};
