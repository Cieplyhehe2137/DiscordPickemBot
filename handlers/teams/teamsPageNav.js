// handlers/teamsPageNav.js
const { logInfo, logWarn, logError } = require("../../utils/logger");
const teamsState = require("../../utils/teamsState");
const openTeamsManager = require("./openTeamsManager");

module.exports = async function teamsPageNav(interaction) {
  try {
    // guard: tylko serwer
    if (!interaction.guildId) {
      return interaction.reply({
        content: "❌ Ta akcja działa tylko na serwerze.",
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const customId = interaction.customId;

    const st = teamsState.getState(guildId, userId) || { page: 0 };
    const page = Number(st.page) || 0;

    if (customId === "teams:page_prev") {
      st.page = Math.max(0, page - 1);
    } else if (customId === "teams:page_next") {
      st.page = page + 1;
    } else {
      // safety – ktoś kliknął nie ten przycisk
      return;
    }

    // 🔐 czyścimy wybór przy zmianie strony
    // (żeby nie usunąć drużyn z innej strony)
    st.selectedTeamIds = [];
    st.selectedTeamId = null;

    teamsState.setState(guildId, userId, st);

    // openTeamsManager sam decyduje update vs reply
    return openTeamsManager(interaction);
  } catch (err) {
    logError("teams", "teamsPageNav failed", {
      guildId: interaction.guildId,
      userId: interaction.user?.id,
      message: err.message,
      stack: err.stack,
    });

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: "❌ Nie udało się zmienić strony.",
        ephemeral: true,
      });
    }
  }
};
