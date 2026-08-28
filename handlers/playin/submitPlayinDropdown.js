// handlers/playin/submitPlayinDropdown.js

const { withGuild } = require("../../utils/guildContext");
const { logInfo, logger } = require("../../utils/logger");
const { assertPredictionsAllowed } = require("../../utils/protectionsGuards");

const {
  getDraft,
  setDraft,
  clearDraft,
} = require("../../utils/predictionDraftCache");

const { loadActiveTeams } = require("../../utils/loadActiveTeams");
const { getOpenEventId } = require("../../utils/getOpenEventId");

const NAMESPACE = "playin";

const getCache = (key) => getDraft(NAMESPACE, key);
const setCache = (key, data) => setDraft(NAMESPACE, key, data);

// ======================================================
// HANDLER
// ======================================================

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const userId = interaction.user?.id;

  if (!guildId) {
    return interaction.reply({
      content: "❌ Ta akcja działa tylko na serwerze.",
      ephemeral: true,
    });
  }

  if (!userId) return;

  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;
  const cacheKey = `${guildId}:${userId}`;

  // ====================================================
  // SELECT MENU
  // ====================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "playin_select"
  ) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({
        ephemeral: true,
      });
    }

    // ==================================================
    // PHASE GATE
    // ==================================================

    const gate = await assertPredictionsAllowed({
      guildId,
      kind: "PLAYIN",
    });

    if (!gate.allowed) {
      return interaction.editReply({
        content:
          gate.message ||
          "❌ Typowanie fazy Play-In jest aktualnie niedostępne.",
      });
    }

    // ==================================================
    // EVENT-BOUND DRAFT
    // ==================================================

    const draft = getCache(cacheKey);

    if (!draft || !draft.eventId) {
      return interaction.editReply({
        content:
          "❌ Ten formularz Pick'Em nie jest już aktualny.\n" +
          "Otwórz najnowszy panel Play-In.",
      });
    }

    // ==================================================
    // CHECK CURRENT EVENT
    // ==================================================

    return withGuild(interaction, async ({ pool, guildId }) => {
      const currentEventId = await getOpenEventId(pool, guildId);

      if (!currentEventId) {
        return interaction.editReply({
          content: "❌ Nie znaleziono aktywnego eventu.",
        });
      }

      if (Number(draft.eventId) !== Number(currentEventId)) {
        clearDraft(NAMESPACE, cacheKey);

        return interaction.editReply({
          content:
            "❌ Ten formularz pochodzi z poprzedniego eventu.\n" +
            "Otwórz najnowszy panel Pick'Em.",
        });
      }

      // ==================================================
      // VALUES
      // ==================================================

      const values = (interaction.values || []).map(String);

      if (values.length !== 8) {
        return interaction.editReply({
          content: "❌ Musisz wybrać **dokładnie 8 drużyn**.",
        });
      }

      if (new Set(values).size !== 8) {
        return interaction.editReply({
          content: "❌ Drużyny nie mogą się powtarzać.",
        });
      }

      // ==================================================
      // SAVE DRAFT
      // ==================================================

      setCache(cacheKey, {
        eventId: draft.eventId,
        teams: values,
      });

      logger.debug("submit", "Play-In dropdown updated", {
        guildId,
        eventId: draft.eventId,
        userId,
        count: values.length,
        teams: values,
      });

      return interaction.editReply({
        content:
          "✅ Wybór **8 drużyn** zapisany.\n" +
          "Kliknij **Zatwierdź typy**, aby zapisać Pick'Em.",
      });
    });
  }

  // ====================================================
  // CONFIRM BUTTON
  // ====================================================

  if (!interaction.isButton() || interaction.customId !== "confirm_playin") {
    return;
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({
      ephemeral: true,
    });
  }

  return withGuild(interaction, async ({ pool, guildId }) => {
    // ==================================================
    // PHASE GATE
    // ==================================================

    const gate = await assertPredictionsAllowed({
      guildId,
      kind: "PLAYIN",
    });

    if (!gate.allowed) {
      return interaction.editReply({
        content:
          gate.message ||
          "❌ Typowanie fazy Play-In jest aktualnie niedostępne.",
      });
    }

    // ==================================================
    // DRAFT
    // ==================================================

    const draft = getCache(cacheKey);

    if (!draft || !draft.eventId) {
      return interaction.editReply({
        content:
          "❌ Ten formularz Pick'Em nie jest już aktualny.\n" +
          "Otwórz najnowszy panel Play-In.",
      });
    }

    const picked = draft.teams;

    if (!Array.isArray(picked) || picked.length !== 8) {
      return interaction.editReply({
        content: "❌ Musisz wybrać **dokładnie 8 drużyn**.",
      });
    }

    if (new Set(picked).size !== 8) {
      return interaction.editReply({
        content: "❌ Drużyny nie mogą się powtarzać.",
      });
    }

    // ==================================================
    // CURRENT EVENT
    // ==================================================

    const currentEventId = await getOpenEventId(pool, guildId);

    if (!currentEventId) {
      return interaction.editReply({
        content: "❌ Nie znaleziono aktywnego eventu.",
      });
    }

    // ==================================================
    // EVENT CONSISTENCY
    // ==================================================

    if (Number(draft.eventId) !== Number(currentEventId)) {
      clearDraft(NAMESPACE, cacheKey);

      return interaction.editReply({
        content:
          "❌ Ten formularz pochodzi z poprzedniego eventu.\n" +
          "Otwórz najnowszy panel Pick'Em.",
      });
    }

    // ==================================================
    // ACTIVE TEAMS
    // ==================================================

    const teamNames = await loadActiveTeams(pool, guildId);
    const allowed = new Set(teamNames);

    const invalid = picked.filter((team) => !allowed.has(team));

    if (invalid.length) {
      return interaction.editReply({
        content:
          `❌ Nieznane lub nieaktywne drużyny: ` + `**${invalid.join(", ")}**`,
      });
    }

    // ==================================================
    // SAVE
    // ==================================================

    const teamsString = picked.join(", ");

    await pool.query(
      `
      INSERT INTO playin_predictions (
        guild_id,
        event_id,
        user_id,
        username,
        displayname,
        teams,
        active,
        submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

      ON DUPLICATE KEY UPDATE
        event_id     = VALUES(event_id),
        teams        = VALUES(teams),
        displayname  = VALUES(displayname),
        active       = 1,
        submitted_at = CURRENT_TIMESTAMP
      `,
      [guildId, currentEventId, userId, username, displayName, teamsString],
    );

    // ==================================================
    // CLEAR DRAFT
    // ==================================================

    clearDraft(NAMESPACE, cacheKey);

    // ==================================================
    // LOG
    // ==================================================

    logInfo("submit", "Play-In predictions saved", {
      guildId,
      eventId: currentEventId,
      userId,
      teams: teamsString,
    });

    return interaction.editReply({
      content: "✅ Twoje typy Play-In zostały zapisane!",
    });
  });
};
