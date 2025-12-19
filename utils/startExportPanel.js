// startExportPanel.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const logger = require('./logger'); // jeśli plik jest w root

module.exports = async (client) => {
  try {
    const channelId = '1387140988954476654';
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      logger.error("interaction", "Export panel channel not found", {
        channelId
      });
      return;
    }

    logger.info("interaction", "Export panel channel fetched", {
      channel: channel.name,
      channelId
    });

    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setTitle('📊 Panel eksportowy Pick\'Em')
      .setDescription(
        '➔ Tutaj możesz:\n' +
        '• Eksportować wyniki\n' +
        '• Wykonać backup bazy danych\n' +
        '• Wprowadzić oficjalne wyniki (Swiss / Playoffs / Double)\n' +
        '• Zarządzać danymi turnieju\n\n' +
        '⚠️ **Dostęp tylko dla Administracji serwera**'
      );

    // =======================
    // RZĄD 1 – eksport + backup
    // =======================
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('export_ranking')
        .setLabel('📁 Eksport klasyfikacji')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('backup_database')
        .setLabel('💾 Backup bazy')
        .setStyle(ButtonStyle.Secondary),
       
      new ButtonBuilder()
        .setCustomId('restore_backup')
        .setLabel('♻️ Przywróć bazę')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('set_results_playin')
        .setLabel('📄 Wyniki Play-In')
        .setStyle(ButtonStyle.Primary),
 
    );

    // =======================
    // RZĄD 2 – oficjalne wyniki
    // =======================
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('set_results_swiss_stage1')
        .setLabel('📑 Swiss — Stage 1')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('set_results_swiss_stage2')
        .setLabel('📑 Swiss — Stage 2')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('set_results_swiss_stage3')
        .setLabel('📑 Swiss — Stage 3')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('open_results_playoffs')
        .setLabel('📑 Wyniki Playoffs')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('set_results_double')
        .setLabel('📑 Wyniki Double Elim')
        .setStyle(ButtonStyle.Primary)
    );

    // =======================
    // RZĄD 3 – czyszczenie
    // =======================
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('clear_user_picks')
        .setLabel('✏️ Wyczyść typy userów')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('full_reset')
        .setLabel('🗑 Pełny reset (łącznie z wynikami)')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('clear_official_results')
        .setLabel('🗑 Wyczyść tylko oficjalne wyniki')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      embeds: [embed],
      components: [row1, row2, row3]
    });

    logger.info("interaction", "Export panel sent", {
      channel: channel.name
    });

  } catch (err) {
    logger.error("interaction", "startExportPanel failed", {
      message: err.message,
      stack: err.stack
    });
  }
};
