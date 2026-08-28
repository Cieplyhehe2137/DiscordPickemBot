const { withGuild } = require("../../utils/guildContext");

const { assertPredictionsAllowed } = require("../../utils/protectionsGuards");

const {
  getDraft,
  setDraft,
  clearDraft,
} = require("../../utils/predictionDraftCache");

const { loadActiveTeams } = require("../../utils/loadActiveTeams");

const { getOpenEventId } = require("../../utils/getOpenEventId");

const { logError } = require("../../utils/logger");

// ======================================================
// CONSTANTS
// ======================================================

const NAMESPACE = "swiss";

const getCache = (key) => getDraft(NAMESPACE, key);

const setCache = (key, data) => setDraft(NAMESPACE, key, data);

// ======================================================
// HELPERS
// ======================================================

function buildCacheKey(guildId, userId, stage) {
  return `${guildId}:${userId}:${stage}`;
}

function isDraftCurrent(draft, eventId, stage) {
  if (!draft?.eventId) {
    return false;
  }

  if (Number(draft.eventId) !== Number(eventId)) {
    return false;
  }

  if (
    String(draft.stage || "").toLowerCase() !==
    String(stage || "").toLowerCase()
  ) {
    return false;
  }

  return true;
}

// ======================================================
// HANDLER
// ======================================================

module.exports = async (interaction) => {
  try {
    // ==================================================
    // BASIC DATA
    // ==================================================

    if (!interaction.guildId) return;

    const { customId } = interaction;

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const username = interaction.user.username;

    const displayName = interaction.member?.displayName || username;

    // ==================================================
    // DROPDOWN
    // ==================================================

    const dropdownMatch = customId.match(
      /^swiss_(3_0|0_3|advancing):(stage[123])$/,
    );

    if (interaction.isStringSelectMenu() && dropdownMatch) {
      const typeRaw = dropdownMatch[1];

      const stage = dropdownMatch[2];

      const type =
        typeRaw === "3_0" ? "3" : typeRaw === "0_3" ? "0" : "advancing";

      // ================================================
      // ACK
      // ================================================

      await interaction.deferUpdate();

      // ================================================
      // GUILD CONTEXT
      // ================================================

      return withGuild(interaction, async ({ pool }) => {
        // ============================================
        // PHASE / DEADLINE GUARD
        // ============================================

        const gate = await assertPredictionsAllowed({
          guildId,
          kind: "SWISS",
          stage,
        });

        if (!gate.allowed) {
          return interaction.followUp({
            content:
              gate.message || "❌ Typowanie tej fazy Swiss jest zamknięte.",
            ephemeral: true,
          });
        }

        // ============================================
        // CURRENT EVENT
        // ============================================

        const currentEventId = await getOpenEventId(pool, guildId);

        if (!currentEventId) {
          return interaction.followUp({
            content: "❌ Nie znaleziono aktywnego turnieju.",
            ephemeral: true,
          });
        }

        // ============================================
        // EVENT + STAGE BOUND DRAFT
        // ============================================

        const cacheKey = buildCacheKey(guildId, userId, stage);

        const local = getCache(cacheKey);

        if (!isDraftCurrent(local, currentEventId, stage)) {
          clearDraft(NAMESPACE, cacheKey);

          return interaction.followUp({
            content:
              "❌ Ten formularz Swiss nie jest już aktualny.\n" +
              "Otwórz najnowszy panel typowania.",
            ephemeral: true,
          });
        }

        // ============================================
        // SELECTED VALUES
        // ============================================

        const incoming = interaction.values.map(String);

        // Discord powinien pilnować liczby wyborów,
        // ale sprawdzamy również po stronie bota.

        const expectedCount = type === "advancing" ? 6 : 2;

        if (incoming.length !== expectedCount) {
          return interaction.followUp({
            content: `⚠️ Dla tej kategorii musisz wybrać dokładnie **${expectedCount}** drużyn.`,
            ephemeral: true,
          });
        }

        // ============================================
        // UNIQUE INSIDE CATEGORY
        // ============================================

        if (new Set(incoming).size !== incoming.length) {
          return interaction.followUp({
            content: "⚠️ Ta sama drużyna nie może zostać wybrana kilka razy.",
            ephemeral: true,
          });
        }

        // ============================================
        // ACTIVE TEAMS VALIDATION
        // ============================================

        const validTeams = await loadActiveTeams(pool, guildId);

        const invalid = incoming.filter((team) => !validTeams.includes(team));

        if (invalid.length) {
          return interaction.followUp({
            content: `⚠️ Nieaktywne lub nieznane drużyny: ${invalid.join(", ")}`,
            ephemeral: true,
          });
        }

        // ============================================
        // DUPLICATES BETWEEN CATEGORIES
        // ============================================

        const otherTeams = [];

        if (type !== "3") {
          otherTeams.push(...(local["3"] || []));
        }

        if (type !== "0") {
          otherTeams.push(...(local["0"] || []));
        }

        if (type !== "advancing") {
          otherTeams.push(...(local["advancing"] || []));
        }

        const duplicates = incoming.filter((team) => otherTeams.includes(team));

        if (duplicates.length) {
          return interaction.followUp({
            content: `⚠️ Drużyna nie może występować w więcej niż jednej kategorii: **${[
              ...new Set(duplicates),
            ].join(", ")}**`,
            ephemeral: true,
          });
        }

        // ============================================
        // SAVE DRAFT
        // ============================================

        setCache(cacheKey, {
          ...local,

          eventId: Number(currentEventId),

          stage,

          [type]: incoming,
        });

        return;
      });
    }

    // ==================================================
    // CONFIRM
    // ==================================================

    const confirmMatch = customId.match(/^confirm_swiss:(stage[123])$/);

    if (!interaction.isButton() || !confirmMatch) {
      return;
    }

    const stage = confirmMatch[1];

    const cacheKey = buildCacheKey(guildId, userId, stage);

    // ==================================================
    // ACK
    // ==================================================

    await interaction.deferReply({
      ephemeral: true,
    });

    // ==================================================
    // GUILD CONTEXT
    // ==================================================

    return withGuild(interaction, async ({ pool }) => {
      // ==============================================
      // PHASE / DEADLINE GUARD
      // ==============================================

      const gate = await assertPredictionsAllowed({
        guildId,
        kind: "SWISS",
        stage,
      });

      if (!gate.allowed) {
        return interaction.editReply(
          gate.message || "❌ Typowanie jest zamknięte.",
        );
      }

      // ==============================================
      // CURRENT EVENT
      // ==============================================

      const currentEventId = await getOpenEventId(pool, guildId);

      if (!currentEventId) {
        return interaction.editReply(
          "❌ Nie znaleziono aktywnego turnieju dla tego serwera.",
        );
      }

      // ==============================================
      // DRAFT
      // ==============================================

      const data = getCache(cacheKey);

      if (!isDraftCurrent(data, currentEventId, stage)) {
        clearDraft(NAMESPACE, cacheKey);

        return interaction.editReply(
          "❌ Ten formularz Swiss nie jest już aktualny.\n" +
            "Otwórz najnowszy panel typowania.",
        );
      }

      // ==============================================
      // COMPLETENESS
      // ==============================================

      if (
        !Array.isArray(data["3"]) ||
        !Array.isArray(data["0"]) ||
        !Array.isArray(data["advancing"])
      ) {
        return interaction.editReply(
          "❌ Najpierw wybierz drużyny dla **3-0**, **0-3** i **awansujących**.",
        );
      }

      // ==============================================
      // COUNTS
      // ==============================================

      if (
        data["3"].length !== 2 ||
        data["0"].length !== 2 ||
        data["advancing"].length !== 6
      ) {
        return interaction.editReply("⚠️ Nieprawidłowa liczba drużyn.");
      }

      // ==============================================
      // GLOBAL UNIQUENESS
      // ==============================================

      const all = [...data["3"], ...data["0"], ...data["advancing"]];

      if (new Set(all).size !== all.length) {
        return interaction.editReply(
          "⚠️ Ta sama drużyna nie może wystąpić w więcej niż jednej kategorii.",
        );
      }

      // ==============================================
      // ACTIVE TEAMS VALIDATION
      // ==============================================

      const validTeams = await loadActiveTeams(pool, guildId);

      const invalid = all.filter((team) => !validTeams.includes(team));

      if (invalid.length) {
        return interaction.editReply(
          `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(", ")}`,
        );
      }

      // ==============================================
      // FINAL EVENT CONSISTENCY CHECK
      // ==============================================
      //
      // Sprawdzamy jeszcze raz tuż przed INSERT-em.
      // Dzięki temu nawet gdy event zmieni się podczas
      // obsługi interakcji, nie zapiszemy typu do
      // przypadkowego turnieju.
      // ==============================================

      const finalEventId = await getOpenEventId(pool, guildId);

      if (!finalEventId || Number(finalEventId) !== Number(data.eventId)) {
        clearDraft(NAMESPACE, cacheKey);

        return interaction.editReply(
          "❌ Event zmienił się podczas typowania.\n" +
            "Otwórz najnowszy panel Swiss.",
        );
      }

      // ==============================================
      // SAVE
      // ==============================================

      await pool.query(
        `
          INSERT INTO swiss_predictions (
            guild_id,
            event_id,
            user_id,
            username,
            displayname,
            stage,
            pick_3_0,
            pick_0_3,
            advancing,
            active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)

          ON DUPLICATE KEY UPDATE
            event_id = VALUES(event_id),
            username = VALUES(username),
            pick_3_0 = VALUES(pick_3_0),
            pick_0_3 = VALUES(pick_0_3),
            advancing = VALUES(advancing),
            displayname = VALUES(displayname),
            active = 1,
            submitted_at = CURRENT_TIMESTAMP
          `,
        [
          guildId,
          finalEventId,
          userId,
          username,
          displayName,
          stage,
          data["3"].join(", "),
          data["0"].join(", "),
          data["advancing"].join(", "),
        ],
      );

      // ==============================================
      // CLEAR DRAFT
      // ==============================================

      clearDraft(NAMESPACE, cacheKey);

      // ==============================================
      // RESPONSE
      // ==============================================

      return interaction.editReply("✅ Twoje typy zostały zapisane!");
    });
  } catch (err) {
    // ==================================================
    // ERROR
    // ==================================================

    logError("swiss", "submitSwissDropdown failed", {
      guildId: interaction.guildId,
      userId: interaction.user?.id,
      customId: interaction.customId,
      message: err?.message,
      stack: err?.stack,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction
        .followUp({
          content: "❌ Nie udało się zapisać typów Swiss.",
          ephemeral: true,
        })
        .catch(() => {});
    }

    return interaction
      .reply({
        content: "❌ Nie udało się zapisać typów Swiss.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
