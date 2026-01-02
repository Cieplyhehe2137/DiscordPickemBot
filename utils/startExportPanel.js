// startExportPanel.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const logger = require('../logger'); // jak masz logger w root, zostaw

const { getGuildConfig } = require('../utils/guildRegistry'); // ✅ per-guild config

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
    logger.error("interaction", "Failed to fetch messages for panel lookup", {
      message: err.message,
      stack: err.stack
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

  // 1 rząd, max 5 przycisków (tu jest 5 i to jest OK)
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
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

// ✅ TERAZ: per guild
module.exports = async (client, guildId) => {
  try {
    const cfg = getGuildConfig(guildId);
    const channelId = cfg?.EXPORT_PANEL_CHANNEL_ID;

    if (!channelId) {
      logger.warn("interaction", "EXPORT_PANEL_CHANNEL_ID missing for guild", { guildId });
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel) {
      logger.error("interaction", "Export panel channel not found", { guildId, channelId });
      return;
    }

    // ✅ Guard: kanał musi należeć do tego guilda (chroni przed pomyłką w env)
    if (channel.guildId && channel.guildId !== guildId) {
      logger.error("interaction", "Export panel channel belongs to different guild (misconfigured)", {
        guildId,
        channelId,
        channelGuildId: channel.guildId
      });
      return;
    }

    logger.info("interaction", "Export panel channel fetched", {
      guildId,
      channel: channel.name,
      channelId
    });

    const payload = buildPanelPayload();

    // spróbuj znaleźć istniejący panel i go zaktualizować
    const existing = await findExistingPanelMessage(channel, client.user.id);

    if (existing) {
      await existing.edit(payload);

      logger.info("interaction", "Export panel updated (edited existing message)", {
        guildId,
        channel: channel.name,
        messageId: existing.id
      });
      return;
    }

    // jeśli nie ma, wyślij nowy
    const sent = await channel.send(payload);

    logger.info("interaction", "Export panel sent (new message)", {
      guildId,
      channel: channel.name,
      messageId: sent.id
    });

  } catch (err) {
    logger.error("interaction", "startExportPanel failed", {
      guildId,
      message: err.message,
      stack: err.stack
    });
  }
};
