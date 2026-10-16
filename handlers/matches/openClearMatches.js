// handlers/openClearMatches.js
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { matchPhaseOptions } = require("../../utils/matchPhases");

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return (
    perms?.has(PermissionFlagsBits.Administrator) ||
    perms?.has(PermissionFlagsBits.ManageGuild)
  );
}

module.exports = async function openClearMatches(interaction) {
  // ===== brak uprawnień =====
  if (!hasAdminPerms(interaction)) {
    const err = {
      content: "❌ Brak uprawnień (Administrator / Zarządzanie serwerem).",
    };

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(err);
    }
    return interaction.reply({ ...err, ephemeral: true });
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("match_clear_phase_select")
      .setPlaceholder("Wybierz fazę…")
      .addOptions(matchPhaseOptions()),
  );

  const payload = {
    content:
      "🧹 Wybierz fazę, z której chcesz **usunąć wszystkie mecze (MATCHES)** wraz z wynikami i punktami dla meczów:",
    components: [row],
  };

  // ===== KLUCZOWA LOGIKA =====
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }

  return interaction.reply({ ...payload, ephemeral: true });
};
