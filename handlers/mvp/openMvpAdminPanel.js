const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

module.exports = async function openMvpAdminPanel(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('⭐ Panel MVP')
    .setDescription(
      'Zarządzanie typowaniem MVP turnieju.\n\n' +
      '• ustaw kandydatów MVP\n' +
      '• ustaw oficjalnego MVP\n' +
      '• pokaż aktualnych kandydatów\n' +
      '• pokaż oficjalny wynik'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mvp:admin:candidates')
      .setLabel('➕ Kandydaci')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('mvp:admin:result')
      .setLabel('🏆 Ustaw MVP')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('mvp:admin:list')
      .setLabel('📋 Kandydaci')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('mvp:admin:show_result')
      .setLabel('📊 Oficjalny MVP')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
};