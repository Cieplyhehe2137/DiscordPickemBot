// handlers/openMatchResults.js
const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

const { matchPhaseOptions } = require("../../utils/matchPhases");

module.exports = async function openMatchResults(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("match_admin_phase_select")
      .setPlaceholder("Wybierz fazę…")
      .addOptions(matchPhaseOptions()),
  );

  const payload = {
    content:
      "📄 Wybierz fazę, dla której chcesz **wprowadzić oficjalne wyniki meczów**:",
    components: [row],
  };

  // 🔑 KLUCZ: nie reply po deferReply
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }

  return interaction.reply({ ...payload, ephemeral: true });
};
