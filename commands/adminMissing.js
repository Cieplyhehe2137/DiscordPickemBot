const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { withGuild } = require("../utils/guildContext");
const {
  getMissingReport,
  chunkLines,
} = require("../utils/adminDiagnostics");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-missing")
    .setDescription("Pokazuje brakujące dane w aktualnym Pick'Emie.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      await withGuild(interaction, async ({ guildId, pool }) => {
        const report = await getMissingReport({
          pool,
          guildId,
        });

        const embed = new EmbedBuilder()
          .setTitle("🧩 Admin Missing")
          .setColor(0xffc107)
          .setDescription(
            report.event
              ? `Event: **${report.event.name}** \`${report.event.id}\``
              : "Event: **nie znaleziono**"
          )
          .setTimestamp();

        for (const section of report.sections.slice(0, 8)) {
          const chunks = chunkLines(section.lines);

          chunks.slice(0, 2).forEach((chunk, index) => {
            embed.addFields({
              name: index === 0 ? section.title : `${section.title} ${index + 1}`,
              value: chunk,
            });
          });
        }

        if (report.sections.length > 8) {
          embed.addFields({
            name: "Uwaga",
            value: "Raport ma więcej sekcji, pokazuję pierwsze 8.",
          });
        }

        await interaction.editReply({
          embeds: [embed],
        });
      });
    } catch (error) {
      console.error("[admin-missing] error:", error);

      await interaction.editReply({
        content: `❌ Błąd podczas sprawdzania braków: \`${error.message}\``,
      });
    }
  },
};