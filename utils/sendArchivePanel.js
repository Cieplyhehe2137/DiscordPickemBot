// utils/sendArchivePanel.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const logger = require('./logger');
const { getGuildConfig, getGuildPaths, ensureGuildDirs } = require('./guildRegistry');

const PANEL_TITLE = "📂 Archiwum Pick'em";

function safeLabel(str) {
  if (!str) return 'plik';
  const s = String(str);
  return s.length > 80 ? s.slice(0, 77) + '...' : s;
}

function listArchiveFiles(archiveDir) {
  if (!fs.existsSync(archiveDir)) return [];

  return fs.readdirSync(archiveDir)
    .filter(f => f.endsWith('.xlsx'))
    .map(f => {
      const full = path.join(archiveDir, f);
      return {
        file: f,
        full,
        mtime: fs.statSync(full).mtimeMs,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

module.exports = async function sendArchivePanel(client, guildId) {
  const gid = String(guildId || '').trim();
  if (!gid) {
    logger.error('archivePanel', 'sendArchivePanel called without guildId', {});
    return;
  }

  try {
    const cfg = getGuildConfig(gid);
    const { archiveDir } = getGuildPaths(gid);
    ensureGuildDirs(gid);

    const channelId = String(cfg?.ARCHIVE_CHANNEL_ID || '').trim();
    if (!channelId) {
      logger.error('archivePanel', 'Missing ARCHIVE_CHANNEL_ID in guild config', { guildId: gid });
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased?.()) {
      logger.error('archivePanel', 'Archive channel not found or not text-based', {
        guildId: gid,
        channelId,
      });
      return;
    }

    if (channel.guildId && String(channel.guildId) !== String(gid)) {
      logger.error('archivePanel', 'ARCHIVE_CHANNEL_ID points to another guild', {
        guildId: gid,
        channelId,
        channelGuildId: channel.guildId,
      });
      return;
    }

    const files = listArchiveFiles(archiveDir);

    const embed = new EmbedBuilder()
      .setTitle(PANEL_TITLE)
      .setDescription(
        files.length
          ? 'Wybierz plik z listy poniżej, aby pobrać archiwum.'
          : 'Brak plików archiwum. Po zakończeniu turnieju pojawią się tutaj eksporty.'
      )
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

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const existing = messages?.find(
      m => m.author?.id === client.user?.id && m.embeds?.[0]?.title === PANEL_TITLE
    );

    if (existing) {
      await existing.edit({ embeds: [embed], components: [row] });
      logger.info('archivePanel', 'Archive panel updated', { guildId: gid, channelId });
    } else {
      await channel.send({ embeds: [embed], components: [row] });
      logger.info('archivePanel', 'Archive panel sent', { guildId: gid, channelId });
    }
  } catch (err) {
    logger.error('archivePanel', 'sendArchivePanel failed', {
      guildId: gid,
      message: err.message,
      stack: err.stack,
    });
  }
};
