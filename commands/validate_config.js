const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const runValidator = require("../validateConfig");
const { DateTime } = require("luxon");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("validate-config")
    .setDescription("Validates the configuration file")
    .addBooleanOption((option) =>
      option
        .setName("embed")
        .setDescription("Whether to embed the output")
        .setRequired(false),
    ),

  async execute(interaction) {
    const isPublic = interaction.options.getBoolean("embed") || false;
    await interaction.deferReply({ ephemeral: !isPublic });

    try {
      const report = await runValidator(interaction.client);

      const color = report.fail.length
        ? 0xe74c3c
        : report.warn.length
          ? 0xf39c12
          : 0x2ecc71;

      const fmt = (arr) => (arr.length ? "• " + arr.join("\n• ") : "-");

      const embed = new EmbedBuilder()
        .setTitle("Configuration Validation")
        .setDescription("The configuration file has been validated.")
        .setColor(color)
        .addFields(
          { name: "Fail", value: fmt(report.fail) },
          { name: "Warn", value: fmt(report.warn) },
          { name: "Pass", value: fmt(report.pass) },
        )
        .setTimestamp();

      if (report.extraNotes?.length) {
        embed.addFields({
          name: "📝 Notatki",
          value: report.extraNotes.join("\n"),
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("validate_config error:", err);
      await interaction.editReply({
        content: `Błąd walidatora: ${err.message || err}`,
      });
    }
  },
};
