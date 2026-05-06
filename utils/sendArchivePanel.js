// utils/sendArchivePanel.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
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

function listArchiveFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.xlsx'))
    .map(f => {
      const full = path.join(dir, f);
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
    logError('archivePanel', 'Called without guildId');
    return;
  }

  try {
    const cfg = getGuildConfig(gid);
    if (!cfg) {
      logError('archivePanel', 'Missing guild config', { guildId: gid });
      return;
    }

    ensureGuildDirs(gid);
    const { archiveDir } = getGuildPaths(gid);

    const channelId = String(cfg.ARCHIVE_CHANNEL_ID || '').trim();
    if (!channelId) {
      logError('archivePanel', 'Missing ARCHIVE_CHANNEL_ID', { guildId: gid });
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      logError('archivePanel', 'Archive channel invalid', {
        guildId: gid,
        channelId,
      });
      return;
    }

    const files = listArchiveFiles(archiveDir);

    const embed = new EmbedBuilder()
      .setTitle(PANEL_TITLE)
      .setDescription(
        files.length
          ? 'Wybierz plik z listy poniżej, aby pobrać archiwum.'
          : 'Brak plików archiwum.'
      )
      .setFooter({ text: `Guild: ${gid}` });

    const options = files.slice(0, 25).map(f => ({
      label: safeLabel(f.file),
      value: f.file, // ✅ stabilne ID
      description: 'Pobierz plik XLSX',
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('archive_select')
        .setPlaceholder(files.length ? 'Wybierz archiwum…' : 'Brak archiwów')
        .setDisabled(!files.length)
        .addOptions(
          options.length
            ? options
            : [{ label: 'Brak archiwów', value: 'none' }]
        )
    );

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const existing = messages?.find(
      m =>
        m.author?.id === client.user?.id &&
        m.embeds?.[0]?.title === PANEL_TITLE
    );

    if (existing) {
      await existing.edit({ embeds: [embed], components: [row] });
      logInfo('archivePanel', 'Updated', { guildId: gid });
    } else {
      await channel.send({ embeds: [embed], components: [row] });
      logInfo('archivePanel', 'Sent', { guildId: gid });
    }
  } catch (err) {
    logError('archivePanel', 'Failed', {
      guildId: gid,
      message: err.message,
      stack: err.stack,
    });
  }
};
