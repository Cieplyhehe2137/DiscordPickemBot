// utils/startExportPanel.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const logger = require('./logger'); // ✅ wrapper loggera (scope, msg, data)
const { getGuildConfig } = require('./guildRegistry');

const PANEL_TITLE = "📊 Panel eksportowy Pick'Em";

// Bezpieczne pobranie ostatnich wiadomości i znalezienie panelu do edycji
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
    logger.error('panel', 'Failed to fetch messages for panel lookup', {
      message: err.message,
      stack: err.stack,
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
    );

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
  const gid = guildId || process.env.GUILD_ID;
  if (!gid) {
    logger.error('panel', 'startExportPanel called without guildId', {});
    return;
  }

  const cfg = getGuildConfig(gid);
  if (!cfg) {
    logger.error('panel', 'Missing guild config for startExportPanel', { guildId: gid });
    return;
  }

  const channelId = String(cfg.EXPORT_PANEL_CHANNEL_ID || '').trim();
  if (!channelId) {
    logger.error('panel', 'Missing EXPORT_PANEL_CHANNEL_ID in guild config', { guildId: gid });
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased?.()) {
      logger.error('panel', 'Export panel channel not found or not text-based', { guildId: gid, channelId });
      return;
    }

    // ✅ Guard: kanał musi należeć do tego guilda
    if (channel.guildId && String(channel.guildId) !== String(gid)) {
      logger.error('panel', 'EXPORT_PANEL_CHANNEL_ID points to a channel in another guild', {
        guildId: gid,
        channelId,
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
