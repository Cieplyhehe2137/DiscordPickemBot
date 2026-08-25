const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = async function openMvpAdminPanel(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("⭐ Panel MVP")
    .setDescription(
      "Zarządzanie typowaniem MVP turnieju.\n\n" +
        "• ustaw kandydatów MVP\n" +
        "• ustaw oficjalnego MVP",
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mvp:admin:candidates")
      .setLabel("➕ Kandydaci")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("mvp:admin:result")
      .setLabel("🏆 Ustaw MVP")
      .setStyle(ButtonStyle.Success),
  );

  return interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
};
