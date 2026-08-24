// handlers/restoreBackupSelector.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function isSafeFilename(name) {
  return typeof name === "string" && /^[\w.-]+\.(sql|json)$/.test(name);
}

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "restore_backup_select") return;

  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "❌ Operacja dostępna tylko na serwerze.",
        ephemeral: true,
      });
    }

    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: "⛔ Tylko administrator może przywracać backup.",
        ephemeral: true,
      });
    }

    const file = interaction.values?.[0];

    if (!isSafeFilename(file)) {
      return interaction.reply({
        content: "❌ Nieprawidłowa nazwa pliku backupu.",
        ephemeral: true,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_restore_backup:${file}`)
        .setLabel("⚠️ Potwierdź przywracanie")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancel_restore_backup")
        .setLabel("❌ Anuluj")
        .setStyle(ButtonStyle.Secondary),
    );

    // 🔥 update zamiast reply
    await interaction.update({
      content:
        "⚠️ **UWAGA: operacja nieodwracalna**\n\n" +
        `Czy na pewno chcesz przywrócić backup:\n**${file}**`,
      components: [row],
    });
  } catch (err) {
    console.error("RESTORE SELECT ERROR:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Błąd podczas wyboru backupu.",
        ephemeral: true,
      });
    }
  }
};
