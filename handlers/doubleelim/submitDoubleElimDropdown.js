// handlers/doubleelim/submitDoubleElimDropdown.js

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

const uniq = (arr) => Array.from(new Set(arr));

const NAMESPACE = "doubleelim";

const getCache = (key) => getDraft(NAMESPACE, key);
const setCache = (key, data) => setDraft(NAMESPACE, key, data);

function slotLabel(key) {
  return (
    {
      upper_final_a: "Upper Final A",
      lower_final_a: "Lower Final A",
      upper_final_b: "Upper Final B",
      lower_final_b: "Lower Final B",
    }[key] || key
  );
}

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) {
    return;
  }

  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.reply({
      content: "❌ Ta akcja działa tylko na serwerze.",
      ephemeral: true,
    });
  }

  const { user, customId } = interaction;

  const userId = user?.id;

  if (!userId) return;

  const username = user.username;
  const displayName = interaction.member?.displayName || username;

  const cacheKey = `${guildId}:${userId}`;

  const selectMap = {
    doubleelim_upper_final_a: "upper_final_a",
    doubleelim_lower_final_a: "lower_final_a",
    doubleelim_upper_final_b: "upper_final_b",
    doubleelim_lower_final_b: "lower_final_b",
  };

  // ====================================================
  // SELECT MENUS
  // ====================================================

  if (interaction.isStringSelectMenu()) {
    const key = selectMap[customId];

    if (!key) {
      return;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({
        ephemeral: true,
      });
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      // ==============================================
      // PHASE GATE
      // ==============================================

      const gate = await assertPredictionsAllowed({
        guildId,
        kind: "DOUBLE_ELIM",
      });

      if (!gate.allowed) {
        return interaction.editReply({
          content:
            gate.message ||
            "❌ Typowanie fazy Double Elimination jest aktualnie niedostępne.",
        });
      }

      // ==============================================
      // EVENT-BOUND DRAFT
      // ==============================================

      const data = getCache(cacheKey);

      if (!data || !data.eventId) {
        return interaction.editReply({
          content:
            "❌ Ten formularz Pick'Em nie jest już aktualny.\n" +
            "Otwórz najnowszy panel Double Elimination.",
        });
      }

      // ==============================================
      // CURRENT EVENT
      // ==============================================

      const currentEventId = await getOpenEventId(pool, guildId);

      if (!currentEventId) {
        return interaction.editReply({
          content: "❌ Nie znaleziono aktywnego eventu.",
        });
      }

      // ==============================================
      // EVENT CONSISTENCY
      // ==============================================

      if (Number(data.eventId) !== Number(currentEventId)) {
        clearDraft(NAMESPACE, cacheKey);

        return interaction.editReply({
          content:
            "❌ Ten formularz pochodzi z poprzedniego eventu.\n" +
            "Otwórz najnowszy panel Pick'Em.",
        });
      }

      // ==============================================
      // VALUES
      // ==============================================

      const values = uniq((interaction.values || []).map(String));

      if (values.length !== 2) {
        return interaction.editReply({
          content: "⚠️ Wybierz dokładnie **2 różne drużyny**.",
        });
      }

      // ==============================================
      // DUPLICATES BETWEEN SLOTS
      // ==============================================

      const usedInOtherSlots = Object.entries(data)
        .filter(([slot]) => slot !== key && slot !== "eventId")
        .flatMap(([, teams]) => (Array.isArray(teams) ? teams : []));

      const duplicated = values.filter((team) =>
        usedInOtherSlots.includes(team),
      );

      if (duplicated.length) {
        return interaction.editReply({
          content:
            `⚠️ ${duplicated.length === 1 ? "Drużyna" : "Drużyny"} ` +
            `**${duplicated.join(", ")}** ` +
            `${
              duplicated.length === 1
                ? "została już wybrana"
                : "zostały już wybrane"
            } w innym slocie.`,
        });
      }

      // ==============================================
      // SAVE DRAFT
      // ==============================================

      data[key] = values;

      setCache(cacheKey, data);

      logger.debug("submit", "Double Elim dropdown updated", {
        guildId,
        eventId: data.eventId,
        userId,
        key,
        values,
      });

      return interaction.editReply({
        content:
          `✅ **${slotLabel(key)}** zapisany: ` +
          `**${values.join(", ")}**.\n` +
          "Uzupełnij pozostałe sloty i kliknij **Zatwierdź typy**.",
      });
    });
  }

  // ====================================================
  // CONFIRM BUTTON
  // ====================================================

  if (!interaction.isButton() || customId !== "confirm_doubleelim") {
    return;
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({
      ephemeral: true,
    });
  }

  return withGuild(interaction, async ({ pool, guildId }) => {
    // ================================================
    // FINAL PHASE GATE
    // ================================================

    const gate = await assertPredictionsAllowed({
      guildId,
      kind: "DOUBLE_ELIM",
    });

    if (!gate.allowed) {
      return interaction.editReply({
        content:
          gate.message ||
          "❌ Typowanie fazy Double Elimination jest aktualnie niedostępne.",
      });
    }

    // ================================================
    // DRAFT
    // ================================================

    const picks = getCache(cacheKey);

    if (!picks || !picks.eventId) {
      return interaction.editReply({
        content:
          "❌ Ten formularz Pick'Em nie jest już aktualny.\n" +
          "Otwórz najnowszy panel Double Elimination.",
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

    if (Number(picks.eventId) !== Number(currentEventId)) {
      clearDraft(NAMESPACE, cacheKey);

      return interaction.editReply({
        content:
          "❌ Ten formularz pochodzi z poprzedniego eventu.\n" +
          "Otwórz najnowszy panel Pick'Em.",
      });
    }

    const required = [
      "upper_final_a",
      "lower_final_a",
      "upper_final_b",
      "lower_final_b",
    ];

    // ================================================
    // COMPLETENESS
    // ================================================

    const missing = required.filter(
      (key) => !Array.isArray(picks[key]) || picks[key].length !== 2,
    );

    if (missing.length) {
      return interaction.editReply({
        content:
          `❌ Brakuje wyborów w: ` +
          `**${missing.map(slotLabel).join(", ")}**.`,
      });
    }

    // ================================================
    // DUPLICATES
    // ================================================

    const all = required.flatMap((key) => picks[key]);

    if (new Set(all).size !== all.length) {
      return interaction.editReply({
        content: "⚠️ Te same drużyny nie mogą się powtarzać między slotami.",
      });
    }

    // ================================================
    // ACTIVE TEAMS
    // ================================================

    const teamNames = await loadActiveTeams(pool, guildId);

    const allowed = new Set(teamNames);

    const invalid = [...new Set(all.filter((team) => !allowed.has(team)))];

    if (invalid.length) {
      return interaction.editReply({
        content:
          `⚠️ Nieaktywne lub nieznane drużyny: ` + `**${invalid.join(", ")}**.`,
      });
    }

    // ================================================
    // SAVE
    // ================================================

    await pool.query(
      `
        INSERT INTO doubleelim_predictions (
          guild_id,
          event_id,
          user_id,
          username,
          displayname,
          upper_final_a,
          lower_final_a,
          upper_final_b,
          lower_final_b
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)

        ON DUPLICATE KEY UPDATE
          event_id      = VALUES(event_id),
          upper_final_a = VALUES(upper_final_a),
          lower_final_a = VALUES(lower_final_a),
          upper_final_b = VALUES(upper_final_b),
          lower_final_b = VALUES(lower_final_b),
          displayname   = VALUES(displayname),
          submitted_at  = CURRENT_TIMESTAMP
        `,
      [
        guildId,
        currentEventId,
        userId,
        username,
        displayName,
        picks.upper_final_a.join(", "),
        picks.lower_final_a.join(", "),
        picks.upper_final_b.join(", "),
        picks.lower_final_b.join(", "),
      ],
    );

    // ================================================
    // CLEAR DRAFT
    // ================================================

    clearDraft(NAMESPACE, cacheKey);

    logInfo("submit", "Double Elim predictions saved", {
      guildId,
      eventId: currentEventId,
      userId,
    });

    return interaction.editReply({
      content: "✅ Twoje typy Double Elimination zostały zapisane!",
    });
  });
};
