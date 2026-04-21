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
const PANEL_MARKER = 'export-panel-v3';

// ====== UI BUILDER ======

function buildPanelComponents() {
  return [
    new ActionRowBuilder().addComponents(
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
    ),

    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:open:mvp')
        .setLabel('⭐ MVP')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function buildPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(PANEL_TITLE)
    .setDescription(
      '➔ Panel administracyjny Pick’Em\n\n' +
      '• Wyniki i eksport\n' +
      '• Zarządzanie meczami\n' +
      '• Backup / restore bazy\n' +
      '• Reset i czyszczenie danych\n' +
      '• Typowanie MVP\n\n' +
      '⚠️ **Dostęp tylko dla Administracji**'
    )
    .setFooter({ text: PANEL_MARKER });

  return {
    embeds: [embed],
    components: buildPanelComponents()
  };
}

// ====== HELPERS ======

async function findExistingPanelMessage(channel, clientUserId) {
  const messages = await channel.messages.fetch({ limit: 25 });
  return messages.find(m =>
    m.author?.id === clientUserId &&
    m.embeds?.[0]?.title === PANEL_TITLE &&
    m.embeds?.[0]?.footer?.text === PANEL_MARKER
  ) || null;
}

// ====== MAIN ======

module.exports = async function startExportPanel(client, guildId) {
  const cfg = getGuildConfig(guildId);
  if (!cfg?.EXPORT_PANEL_CHANNEL_ID) return;

  try {
    const channel = await client.channels.fetch(cfg.EXPORT_PANEL_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const payload = buildPanelPayload();
    const existing = await findExistingPanelMessage(channel, client.user.id);

    if (existing) {
      await existing.edit(payload);
      logger.info('panel', 'Export panel refreshed', { guildId });
      return;
    }

    await channel.send(payload);
    logger.info('panel', 'Export panel sent', { guildId });

  } catch (err) {
    logger.error('panel', 'startExportPanel failed', {
      guildId,
      message: err.message
    });
  }
};