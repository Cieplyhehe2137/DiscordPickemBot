const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { withGuild } = require("../utils/guildContext");
const { getValidateReport, formatCheck, chunkLines } = require("../utils/adminDiagnostics");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("admin-validate")
        .setDescription("Sprawdza czy aktualny PickEm jest poprawnie skonfigurowany.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            await withGuild(interaction, async ({ guildId, pool }) => {
                const report = await getValidateReport({
                    pool,
                    guildId,
                    interaction,
                });

                const ok = report.checks.filter((c) => c.status === "ok").length;
                const warn = report.checks.filter((c) => c.status === "warn").length;
                const error = report.checks.filter((c) => c.status === "error").length;

                const embed = new EmbedBuilder()
                    .setTitle("🛠️ Admin Validate")
                    .setColor(error > 0 ? 0xff3b3b : warn > 0 ? 0xffc107 : 0x2ecc71)
                    .setDescription(
                        [
                            report.event
                                ? `Event: **${report.event.name}** \`${report.event.id}\``
                                : "Event: **nieznaleziono",
                            "",
                            `✅ OK: **${ok}**`,
                            `⚠️ Ostrzeżenia: **${warn}**`,
                            `❌ Błędy: **${error}**`,
                        ].join("\n")
                    )
                    .setTimestamp();

                const lines = report.checks.map(formatCheck);
                const chunks = chunkLines(lines);

                chunk.slice(0, 6).forEach((chunk, index) => {
                    embed.addFields({
                        name: index === 0 ? "Wynik kontroli" : `Wynik kontroli ${index + 1}`,
                        value: chunk,
                    });
                });

                if (chunks.length > 6) {
                    embed.addFields({
                        name: "Uwaga",
                        value: "Wynik jest długi, pokazuję pierwsze sekcje. Resztę najlepiej dorzucić potem do eksportu/logów.",
                    });
                }

                await interaction.editReply({
                    embeds: [embed],
                });
            });
        } catch (error) {
            console.error("[admin-validate] error:", error);

            await interaction.editReply({
                content: `❌ Błąd podczas walidacji: \`${error.message}\``,
            });
        }
    },
};