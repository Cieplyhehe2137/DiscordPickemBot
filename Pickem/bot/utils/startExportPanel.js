// startExportPanel.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = async (client) => {
  try {
    const channelId = '1387380570660671579'; // kanał panelu eksportowego
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      console.error('❌ Nie znaleziono kanału przez fetch. Sprawdź ID i uprawnienia bota.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setTitle('📊 Panel Administracyjny Pick\'Em')
      .setDescription(
        '**Tutaj możesz zarządzać całym systemem Pick\'Em**\n\n' +
        '### 🗂️ Pick\'Em Tools:\n' +
        '• Eksport klasyfikacji (automatycznie przelicza wyniki)\n' +
        '• Wprowadzanie oficjalnych wyników\n' +
        '• Resetowanie baz / typów\n' +
        '• Backup + Restore\n\n' +
        '⚠️ **Dostęp wyłącznie dla Administracji**'
      );

    // ------------------------
    // Rząd 1 – eksport / czyszczenie / Play-In + sync HLTV
    // ------------------------
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('export_ranking')
        .setLabel('📁 Eksport Klasyfikacji')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('set_results_playin')
        .setLabel('📄 Wyniki Play-In')
        .setStyle(ButtonStyle.Primary),
    )

    // ------------------------
    // Rząd 2 – wyniki Swiss / Playoffs / Double
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
        .setCustomId('set_results_playoffs')
        .setLabel('📑 Playoffs')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('set_results_double')
        .setLabel('📑 Double Elim')
        .setStyle(ButtonStyle.Primary)
    );


    // ------------------------
    // Rząd 3 – Pick'Em cleanup + Backup/Restore
    // ------------------------
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('clear_user_picks')
        .setLabel('✏️ Wyczyść typy userów')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('full_reset')
        .setLabel('🗑 Pełny reset')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('clear_official_results')
        .setLabel('🗑 Usuń oficjalne wyniki')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('backup_database')
        .setLabel('💾 Backup DB')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('restore_backup')
        .setLabel('♻️ Restore DB')
        .setStyle(ButtonStyle.Secondary)
    );



    await channel.send({
      embeds: [embed],
      components: [row1, row2, row3]
    });

    console.log(`✅ Panel eksportowy został wysłany.`);
  } catch (err) {
    console.error('❌ Błąd w startExportPanel.js:', err);
  }
};
