// handlers/teamsImportOpen.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = async function teamsImportOpen(interaction) {
  // tylko serwer
  if (!interaction.guildId) {
    return interaction.reply({
      content: "❌ Ta akcja działa tylko na serwerze.",
      ephemeral: true,
    });
  }

  // tylko admin
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "⛔ Tylko administracja.",
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId("teams:import_modal")
    .setTitle("📥 Import drużyn (JSON)");

  const input = new TextInputBuilder()
    .setCustomId("teams_json")
    .setLabel("Wklej JSON z listą drużyn")
    .setPlaceholder('Przykład:\n["FaZe","NAVI","G2","Vitality"]')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000); // bezpieczny limit

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  return interaction.showModal(modal);
};
