// utils/startExportPanel.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');

const logger = require('./logger');
const { getGuildConfig } = require('./guildRegistry');

const PANEL_TITLE = "📊 Panel eksportowy Pick'Em";
const PANEL_MARKER = 'export-panel-v2'; // 🔒 marker bezpieczeństwa

async function findExistingPanelMessage(channel, clientUserId) {
  if (!clientUserId) return null;

  try {
    const messages = await channel.messages.fetch({ limit: 25 });

    return messages.find(m => {
      if (m.author?.id !== clientUserId) return false;
      const e = m.embeds?.[0];
      return e?.title === PANEL_TITLE && e?.footer?.text === PANEL_MARKER;
    }) || null;

  } catch (err) {
    logger.warn('panel', 'Cannot fetch messages for panel lookup (permissions?)', {
      channelId: channel.id,
      message: err.message,
    });
    return null;
  }
}

function buildPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(PANEL_TITLE)
    .setDescription(
      '➔ Tutaj możesz:\n' +
      '• Wprowadzać oficjalne wyniki (Swiss / Playoffs / Double / Play-In)\n' +
      '• Zarządzać meczami\n' +
      '• Wykonać backup / przywrócić bazę\n' +
      '• Wyczyścić dane / zrobić reset\n\n' +
      '⚠️ **Dostęp tylko dla Administracji serwera**'
    )
    .setFooter({ text: PANEL_MARKER });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('panel:open:results')
      .setLabel('📥 Wyniki / Eksport')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('panel:open:matches')
      .setLabel('🎮 Mecze')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('panel:open:db')
      .setLabel('💾 Baza danych')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('panel:open:danger')
      .setLabel('🧨 Czyszczenie / Reset')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('panel:open:teams')
      .setLabel('👥 Drużyny')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = async function startExportPanel(client, guildId) {
  const gid = String(guildId || '').trim();
  if (!gid) {
    logger.error('panel', 'startExportPanel called without guildId');
    return;
  }

  if (!client?.user) {
    logger.warn('panel', 'Client not ready – skipping export panel', { guildId: gid });
    return;
  }

  const cfg = getGuildConfig(gid);
  if (!cfg) {
    logger.error('panel', 'Missing guild config', { guildId: gid });
    return;
  }

  const channelId = String(cfg.EXPORT_PANEL_CHANNEL_ID || '').trim();
  if (!channelId) {
    logger.error('panel', 'Missing EXPORT_PANEL_CHANNEL_ID', { guildId: gid });
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);

    if (
      !channel ||
      channel.type !== ChannelType.GuildText ||
      !channel.isSendable?.()
    ) {
      logger.error('panel', 'Invalid export panel channel', {
        guildId: gid,
        channelId,
        type: channel?.type,
      });
      return;
    }

    if (String(channel.guildId) !== gid) {
      logger.error('panel', 'EXPORT_PANEL_CHANNEL_ID points to another guild', {
        guildId: gid,
        channelGuildId: channel.guildId,
      });
      return;
    }

    const payload = buildPanelPayload();
    const existing = await findExistingPanelMessage(channel, client.user.id);

    if (existing) {
      await existing.edit(payload);
      logger.info('panel', 'Export panel updated', {
        guildId: gid,
        channelId,
        messageId: existing.id,
      });
      return;
    }

    const sent = await channel.send(payload);
    logger.info('panel', 'Export panel sent', {
      guildId: gid,
      channelId,
      messageId: sent.id,
    });

  } catch (err) {
    logger.error('panel', 'startExportPanel failed', {
      guildId: gid,
      channelId,
      message: err.message,
      stack: err.stack,
    });
  }
};
