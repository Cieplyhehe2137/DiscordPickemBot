// startExportPanel.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const logger = require('../logger'); // jeśli plik jest w root

const PANEL_TITLE = "📊 Panel eksportowy Pick'Em";

// Bezpieczne pobranie ostatnich wiadomości i znalezienie panelu do edycji
async function findExistingPanelMessage(channel, clientUserId) {
  try {
    // pobierz ostatnie 50 wiadomości
    const messages = await channel.messages.fetch({ limit: 50 });

    // znajdź NAJNOWSZĄ wiadomość bota, która ma embed z naszym tytułem
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

  // 1 rząd, 4 przyciski → reszta w dropdownach po kliknięciu
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

module.exports = async (client) => {
  try {
    const channelId = process.env.EXPORT_PANEL_CHANNEL_ID || '1387140988954476654';
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      logger.error("interaction", "Export panel channel not found", { channelId });
      return;
    }

    logger.info("interaction", "Export panel channel fetched", {
      channel: channel.name,
      channelId
    });

    const payload = buildPanelPayload();

    // spróbuj znaleźć istniejący panel i go zaktualizować
    const existing = await findExistingPanelMessage(channel, client.user.id);

    if (existing) {
      await existing.edit(payload);

      logger.info("interaction", "Export panel updated (edited existing message)", {
        channel: channel.name,
        messageId: existing.id
      });
      return;
    }

    // jeśli nie ma, wyślij nowy
    const sent = await channel.send(payload);

    logger.info("interaction", "Export panel sent (new message)", {
      channel: channel.name,
      messageId: sent.id
    });

  } catch (err) {
    logger.error("interaction", "startExportPanel failed", {
      message: err.message,
      stack: err.stack
    });
  }
};
