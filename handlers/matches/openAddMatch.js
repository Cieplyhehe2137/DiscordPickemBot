// handlers/openAddMatch.js
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

module.exports = async function openAddMatch(interaction) {
  const response = {
    content: "➕ **Dodawanie meczu** — wybierz fazę:",
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("match_add_phase_select")
          .setPlaceholder("Wybierz fazę…")
          .addOptions(matchPhaseOptions()),
      ),
    ],
  };

  if (!hasAdminPerms(interaction)) {
    const err = {
      content: "❌ Brak uprawnień (Administrator / Zarządzanie serwerem).",
    };

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(err);
    }
    return interaction.reply({ ...err, ephemeral: true });
  }

  // 🔑 KLUCZOWY FRAGMENT
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(response);
  }

  return interaction.reply({ ...response, ephemeral: true });
};
