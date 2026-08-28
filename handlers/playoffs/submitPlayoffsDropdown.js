// handlers/playoffs/submitPlayoffsDropdown.js

const { withGuild } = require("../../utils/guildContext");
const { logInfo } = require("../../utils/logger");
const sendPredictionEmbed = require("../../utils/sendPredictionEmbeds");

const { assertPredictionsAllowed } = require("../../utils/protectionsGuards");

const {
  getDraft,
  setDraft,
  clearDraft,
} = require("../../utils/predictionDraftCache");

const { loadActiveTeams } = require("../../utils/loadActiveTeams");
const { getOpenEventId } = require("../../utils/getOpenEventId");

const NAMESPACE = "playoffs";

const getCache = (guildId, userId) =>
  getDraft(NAMESPACE, `${guildId}:${userId}`);

const setCache = (guildId, userId, data) =>
  setDraft(NAMESPACE, `${guildId}:${userId}`, data);

const clearCache = (guildId, userId) =>
  clearDraft(NAMESPACE, `${guildId}:${userId}`);

// ======================================================
// HANDLER
// ======================================================

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) {
    return;
  }

  const { user, customId } = interaction;

  const userId = user?.id;
  const username = user?.username;
  const displayName = interaction.member?.displayName || username;
  const guildId = interaction.guildId;

  if (!guildId || !userId) return;

  // ====================================================
  // SELECT MENUS
  // ====================================================

  if (interaction.isStringSelectMenu()) {
    if (!customId.startsWith("playoffs_")) {
      return;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({
        ephemeral: true,
      });
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      // ================================================
      // PHASE GATE
      // ================================================

      const gate = await assertPredictionsAllowed({
        guildId,
        kind: "PLAYOFFS",
      });

      if (!gate.allowed) {
        return interaction.editReply({
          content:
            gate.message ||
            "❌ Typowanie fazy Playoffs jest aktualnie niedostępne.",
        });
      }

      // ================================================
      // DRAFT
      // ================================================

      const cache = getCache(guildId, userId);

      if (!cache || !cache.eventId) {
        return interaction.editReply({
          content:
            "❌ Ten formularz Pick'Em nie jest już aktualny.\n" +
            "Otwórz najnowszy panel Playoffs.",
        });
      }

      // ================================================
      // CURRENT EVENT
      // ================================================

      const currentEventId = await getOpenEventId(pool, guildId);

      if (!currentEventId) {
        return interaction.editReply({
          content: "❌ Nie znaleziono aktywnego eventu.",
        });
      }

      // ================================================
      // EVENT CONSISTENCY
      // ================================================

      if (Number(cache.eventId) !== Number(currentEventId)) {
        clearCache(guildId, userId);

        return interaction.editReply({
          content:
            "❌ Ten formularz pochodzi z poprzedniego eventu.\n" +
            "Otwórz najnowszy panel Pick'Em.",
        });
      }

      // ================================================
      // VALUES
      // ================================================

      const values = Array.isArray(interaction.values)
        ? interaction.values.map(String)
        : [];

      let type = customId.slice("playoffs_".length);

      if (type === "third_place") {
        type = "third";
      }

      // ================================================
      // SAVE DRAFT
      // ================================================

      cache[type] = values;

      setCache(guildId, userId, cache);

      logInfo("PLAYOFFS_DROPDOWN_UPDATED", {
        guildId,
        eventId: cache.eventId,
        userId,
        type,
        values,
      });

      return interaction.editReply({
        content:
          "✅ Wybór zapisany. Uzupełnij pozostałe pola i zatwierdź typy.",
      });
    });
  }

  // ====================================================
  // CONFIRM
  // ====================================================

  if (!interaction.isButton() || customId !== "confirm_playoffs") {
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
      kind: "PLAYOFFS",
    });

    if (!gate.allowed) {
      return interaction.editReply({
        content:
          gate.message ||
          "❌ Typowanie fazy Playoffs jest aktualnie niedostępne.",
      });
    }

    // ==================================================
    // DRAFT
    // ==================================================

    const picks = getCache(guildId, userId);

    if (!picks || !picks.eventId) {
      return interaction.editReply({
        content:
          "❌ Ten formularz Pick'Em nie jest już aktualny.\n" +
          "Otwórz najnowszy panel Playoffs.",
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

    if (Number(picks.eventId) !== Number(currentEventId)) {
      clearCache(guildId, userId);

      return interaction.editReply({
        content:
          "❌ Ten formularz pochodzi z poprzedniego eventu.\n" +
          "Otwórz najnowszy panel Pick'Em.",
      });
    }

    const thirdPick = picks.third || [];

    // ==================================================
    // COMPLETENESS
    // ==================================================

    if (
      !Array.isArray(picks.semifinalists) ||
      !Array.isArray(picks.finalists) ||
      !Array.isArray(picks.winner)
    ) {
      return interaction.editReply({
        content: "❌ Wybierz półfinalistów, finalistów oraz zwycięzcę.",
      });
    }

    if (
      picks.semifinalists.length !== 4 ||
      picks.finalists.length !== 2 ||
      picks.winner.length !== 1 ||
      thirdPick.length > 1
    ) {
      return interaction.editReply({
        content: "⚠️ Nieprawidłowa liczba drużyn w jednym z etapów.",
      });
    }

    // ==================================================
    // DUPLICATES
    // ==================================================

    if (new Set(picks.semifinalists).size !== 4) {
      return interaction.editReply({
        content: "⚠️ Półfinaliści nie mogą się powtarzać.",
      });
    }

    if (new Set(picks.finalists).size !== 2) {
      return interaction.editReply({
        content: "⚠️ Finaliści nie mogą się powtarzać.",
      });
    }

    // ==================================================
    // BRACKET LOGIC
    // ==================================================

    const winner = picks.winner[0];

    if (!picks.finalists.includes(winner)) {
      return interaction.editReply({
        content: "⚠️ Zwycięzca musi być jednym z finalistów.",
      });
    }

    for (const finalist of picks.finalists) {
      if (!picks.semifinalists.includes(finalist)) {
        return interaction.editReply({
          content: "⚠️ Finaliści muszą pochodzić z półfinalistów.",
        });
      }
    }

    if (thirdPick[0] && [winner, ...picks.finalists].includes(thirdPick[0])) {
      return interaction.editReply({
        content: "⚠️ 3. miejsce nie może być finalistą ani zwycięzcą.",
      });
    }

    if (thirdPick[0] && !picks.semifinalists.includes(thirdPick[0])) {
      return interaction.editReply({
        content: "⚠️ 3. miejsce musi być jednym z półfinalistów.",
      });
    }

    // ==================================================
    // ACTIVE TEAMS
    // ==================================================

    const teamNames = await loadActiveTeams(pool, guildId);

    const allowed = new Set(teamNames);

    const all = [
      ...picks.semifinalists,
      ...picks.finalists,
      winner,
      ...(thirdPick[0] ? [thirdPick[0]] : []),
    ];

    const invalid = [...new Set(all.filter((team) => !allowed.has(team)))];

    if (invalid.length) {
      return interaction.editReply({
        content:
          `⚠️ Nieznane lub nieaktywne drużyny: ` + `**${invalid.join(", ")}**`,
      });
    }

    // ==================================================
    // SAVE
    // ==================================================

    await pool.query(
      `
      INSERT INTO playoffs_predictions (
        guild_id,
        event_id,
        user_id,
        username,
        displayname,
        semifinalists,
        finalists,
        winner,
        third_place_winner,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)

      ON DUPLICATE KEY UPDATE
        event_id            = VALUES(event_id),
        semifinalists      = VALUES(semifinalists),
        finalists          = VALUES(finalists),
        winner              = VALUES(winner),
        third_place_winner = VALUES(third_place_winner),
        displayname         = VALUES(displayname),
        active              = 1,
        submitted_at        = CURRENT_TIMESTAMP
      `,
      [
        guildId,
        currentEventId,
        userId,
        username,
        displayName,
        picks.semifinalists.join(", "),
        picks.finalists.join(", "),
        winner,
        thirdPick[0] || null,
      ],
    );

    // ==================================================
    // CLEAR DRAFT
    // ==================================================

    clearCache(guildId, userId);

    logInfo("submit", "Playoffs predictions saved", {
      guildId,
      eventId: currentEventId,
      userId,
    });

    // ==================================================
    // PREDICTION EMBED
    // ==================================================

    await sendPredictionEmbed(interaction.client, guildId, "playoffs", userId, {
      semifinalists: picks.semifinalists,
      finalists: picks.finalists,
      winner,
      third_place_winner: thirdPick[0] || null,
    });

    return interaction.editReply({
      content: "✅ Twoje typy Playoffs zostały zapisane!",
    });
  });
};
