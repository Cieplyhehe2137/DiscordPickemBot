// utils/sendArchivePanel.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const logger = require('./logger'); // wrapper loggera (scope, msg, data) lub logger.info/error
const { getGuildConfig, getGuildPaths, ensureGuildDirs } = require('./guildRegistry');

const PANEL_TITLE = "📂 Archiwum Pick'em";

function safeLabel(str) {
  if (!str) return 'plik';
  const s = String(str);
  return s.length > 80 ? s.slice(0, 77) + '...' : s;
}

function listArchiveFiles(archiveDir) {
  if (!fs.existsSync(archiveDir)) return [];
  const files = fs.readdirSync(archiveDir)
    .filter(f => f.endsWith('.xlsx'))
    .map(f => ({
      file: f,
      full: path.join(archiveDir, f),
      mtime: fs.statSync(path.join(archiveDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files;
}

module.exports = async function sendArchivePanel(client, guildId) {
  // ✅ multi-guild: wymagany guildId
  const gid = String(guildId || '').trim();
  if (!gid) throw new Error('sendArchivePanel: guildId jest wymagane (bez fallbacku na process.env.GUILD_ID)');

  const cfg = getGuildConfig(gid);
  const { archiveDir } = getGuildPaths(gid);
  ensureGuildDirs(gid);

  const channelId = String(cfg.ARCHIVE_CHANNEL_ID || '').trim();
  if (!channelId) {
    // jeśli logger nie ma .error, to możesz zamienić na logger('archivePanel', ...)
    logger.error?.('archivePanel', 'Missing ARCHIVE_CHANNEL_ID in guild config', { guildId: gid });
    if (!logger.error) logger('archivePanel', '❌ Missing ARCHIVE_CHANNEL_ID in guild config', { guildId: gid });
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    if (logger.error) logger.error('archivePanel', `Nie mogę pobrać ARCHIVE_CHANNEL_ID=${channelId}`, { guildId: gid });
    else logger('archivePanel', `❌ Nie mogę pobrać ARCHIVE_CHANNEL_ID=${channelId}`, { guildId: gid });
    return;
  }

  // ✅ kanał musi być tekstowy
  if (!channel.isTextBased?.()) {
    if (logger.error) logger.error('archivePanel', 'Archive channel is not text-based', { guildId: gid, channelId });
    else logger('archivePanel', '❌ Archive channel is not text-based', { guildId: gid, channelId });
    return;
  }

  // ✅ Guard: kanał musi należeć do tego guilda
  if (channel.guildId && String(channel.guildId) !== String(gid)) {
    if (logger.error) logger.error('archivePanel', 'ARCHIVE_CHANNEL_ID wskazuje kanał z innej guildy', {
      guildId: gid,
      channelGuildId: channel.guildId,
      channelId,
    });
    else logger('archivePanel', '❌ ARCHIVE_CHANNEL_ID wskazuje kanał z innej guildy', {
      guildId: gid,
      channelGuildId: channel.guildId,
      channelId,
    });
    return;
  }

  const files = listArchiveFiles(archiveDir);

  const embed = new EmbedBuilder()
    .setTitle(PANEL_TITLE)
    .setDescription(files.length
      ? 'Wybierz plik z listy poniżej, aby pobrać archiwum.'
      : 'Brak plików archiwum. Po zakończeniu turnieju pojawią się tutaj eksporty.')
    .setFooter({ text: `Guild: ${gid}` });

  const options = files.slice(0, 25).map(f => ({
    label: safeLabel(f.file),
    value: f.file,
    description: 'Pobierz plik XLSX',
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('archive_select')
      .setPlaceholder(files.length ? 'Wybierz archiwum…' : 'Brak archiwów')
      .setDisabled(!files.length)
      .addOptions(options.length ? options : [{ label: 'Brak archiwów', value: 'none' }])
  );

  // jeśli panel już istnieje — edytuj, inaczej wyślij nowy
  const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
  const existing = messages?.find(m => m.author?.id === client.user.id && m.embeds?.[0]?.title === PANEL_TITLE);

  if (existing) {
    await existing.edit({ embeds: [embed], components: [row] });
    if (logger.info) logger.info('archivePanel', 'Zaktualizowano panel archiwum', { guildId: gid, channelId });
    else logger('archivePanel', '✅ Zaktualizowano panel archiwum', { guildId: gid, channelId });
  } else {
    await channel.send({ embeds: [embed], components: [row] });
    if (logger.info) logger.info('archivePanel', 'Wysłano panel archiwum', { guildId: gid, channelId });
    else logger('archivePanel', '✅ Wysłano panel archiwum', { guildId: gid, channelId });
  }
};
