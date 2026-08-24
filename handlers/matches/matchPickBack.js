const { sendMatchList } = require("./openMatchPick");
const { logError } = require("../../utils/logger");

module.exports = async function matchPickBack(interaction) {
  try {
    const customId = interaction.customId || "";

    // Format:
    // match_pick_back:phaseKey:page
    const [, phaseKey, rawPage] = customId.split(":");

    if (!phaseKey) {
      return interaction.update({
        content: "❌ Brak informacji o fazie.",
        components: [],
      });
    }

    const page = Math.max(0, Number(rawPage) || 0);

    return sendMatchList({
      interaction,
      phaseKey,
      mode: "pred",
      page,
      isUpdate: true,
    });
  } catch (err) {
    logError("matches", "matchPickBack failed", {
      message: err.message,
      stack: err.stack,
    });

    return interaction
      .update({
        content: "❌ Nie udało się wrócić do listy meczów.",
        components: [],
      })
      .catch(() => {});
  }
};
