const { withGuild } = require("./guildContext");

const { logError } = require("./logger");

// ======================================================
// NORMALIZACJE
// ======================================================

function normalizePhase(phase) {
  const value = String(phase || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    // SWISS
    swiss_stage_1: "SWISS_STAGE1",
    swiss_stage1: "SWISS_STAGE1",
    stage1: "SWISS_STAGE1",

    swiss_stage_2: "SWISS_STAGE2",
    swiss_stage2: "SWISS_STAGE2",
    stage2: "SWISS_STAGE2",

    swiss_stage_3: "SWISS_STAGE3",
    swiss_stage3: "SWISS_STAGE3",
    stage3: "SWISS_STAGE3",

    // PLAYOFFS
    playoffs: "PLAYOFFS",

    // PLAY-IN
    playin: "PLAYIN",
    play_in: "PLAYIN",

    // DOUBLE ELIM
    double: "DOUBLEELIM",
    doubleelim: "DOUBLEELIM",
    double_elim: "DOUBLEELIM",
    double_elimination: "DOUBLEELIM",
  };

  return aliases[value] || value.toUpperCase();
}

function normalizeStage(stage) {
  const value = String(stage || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    [
      "1",
      "stage1",
      "stage_1",
      "swiss1",
      "swiss_1",
      "swiss_stage1",
      "swiss_stage_1",
    ].includes(value)
  ) {
    return "STAGE1";
  }

  if (
    [
      "2",
      "stage2",
      "stage_2",
      "swiss2",
      "swiss_2",
      "swiss_stage2",
      "swiss_stage_2",
    ].includes(value)
  ) {
    return "STAGE2";
  }

  if (
    [
      "3",
      "stage3",
      "stage_3",
      "swiss3",
      "swiss_3",
      "swiss_stage3",
      "swiss_stage_3",
    ].includes(value)
  ) {
    return "STAGE3";
  }

  return null;
}

function swissStageToPhase(stage) {
  const normalized = normalizeStage(stage);

  if (normalized === "STAGE1") {
    return "SWISS_STAGE1";
  }

  if (normalized === "STAGE2") {
    return "SWISS_STAGE2";
  }

  if (normalized === "STAGE3") {
    return "SWISS_STAGE3";
  }

  return null;
}

// ======================================================
// EVENT STATE
// ======================================================

async function getPredictionEventState(guildId) {
  if (!guildId) {
    return {
      exists: false,
      isOpen: false,
      phase: "UNKNOWN",
      eventId: null,
      eventName: null,
      status: null,
      error: "Missing guildId",
    };
  }

  try {
    return await withGuild(guildId, async ({ pool }) => {
      const [[event]] = await pool.query(
        `
            SELECT
              id,
              name,
              phase,
              status,
              is_open,
              is_active
            FROM events
            WHERE guild_id = ?
              AND (
                is_active = 1
                OR is_open = 1
                OR status = 'OPEN'
              )
            ORDER BY
              is_active DESC,
              is_open DESC,
              id DESC
            LIMIT 1
            `,
        [guildId],
      );

      if (!event) {
        return {
          exists: false,
          isOpen: false,
          phase: "UNKNOWN",
          eventId: null,
          eventName: null,
          status: null,
        };
      }

      const phase = normalizePhase(event.phase);

      const status = String(event.status || "").toUpperCase();

      const isOpen = Number(event.is_open) === 1 || status === "OPEN";

      return {
        exists: true,

        eventId: Number(event.id),

        eventName: event.name || null,

        phase,

        status,

        isOpen,

        isActive: Number(event.is_active) === 1,
      };
    });
  } catch (err) {
    logError("protections", "getPredictionEventState failed", {
      guildId,
      message: err?.message,
      stack: err?.stack,
    });

    return {
      exists: false,
      isOpen: false,
      phase: "UNKNOWN",
      eventId: null,
      eventName: null,
      status: null,
      error: err?.message || "Unknown error",
    };
  }
}

// ======================================================
// CORE
// ======================================================

async function assertPredictionsAllowed({ guildId, kind, stage = null }) {
  const state = await getPredictionEventState(guildId);

  // ==================================================
  // BRAK AKTYWNEGO EVENTU
  // ==================================================

  if (!state.exists) {
    return {
      allowed: false,
      state,

      message: "❌ Brak aktywnego eventu Pick'Em.",
    };
  }

  // ==================================================
  // EVENT ZAMKNIĘTY
  // ==================================================

  if (!state.isOpen) {
    return {
      allowed: false,
      state,

      message: "❌ Typowanie jest aktualnie **zamknięte**.",
    };
  }

  const currentPhase = normalizePhase(state.phase);

  const requestedKind = normalizePhase(kind);

  // ==================================================
  // MECZE
  // ==================================================
  //
  // Typy meczowe mają własny lock/deadline.
  // Tutaj sprawdzamy tylko, czy event jest otwarty.
  // ==================================================

  if (requestedKind === "MATCHES") {
    return {
      allowed: true,
      state,
    };
  }

  // ==================================================
  // SWISS
  // ==================================================

  if (requestedKind === "SWISS") {
    const expectedPhase = swissStageToPhase(stage);

    if (!currentPhase.startsWith("SWISS_STAGE")) {
      return {
        allowed: false,
        state,

        message:
          `❌ Aktualna faza to **${currentPhase}** — ` +
          "typowanie Swiss jest niedostępne.",
      };
    }

    if (expectedPhase && currentPhase !== expectedPhase) {
      return {
        allowed: false,
        state,

        message:
          `❌ Ten panel jest dla **${expectedPhase}**, ` +
          `a aktualna faza to **${currentPhase}**.`,
      };
    }

    return {
      allowed: true,
      state,
    };
  }

  // ==================================================
  // PLAYOFFS
  // ==================================================

  if (requestedKind === "PLAYOFFS") {
    if (currentPhase !== "PLAYOFFS") {
      return {
        allowed: false,
        state,

        message:
          `❌ Aktualna faza to **${currentPhase}** — ` +
          "typowanie Playoffs jest niedostępne.",
      };
    }

    return {
      allowed: true,
      state,
    };
  }

  // ==================================================
  // PLAY-IN
  // ==================================================

  if (requestedKind === "PLAYIN") {
    if (currentPhase !== "PLAYIN") {
      return {
        allowed: false,
        state,

        message:
          `❌ Aktualna faza to **${currentPhase}** — ` +
          "typowanie Play-In jest niedostępne.",
      };
    }

    return {
      allowed: true,
      state,
    };
  }

  // ==================================================
  // DOUBLE ELIMINATION
  // ==================================================

  if (requestedKind === "DOUBLEELIM") {
    if (currentPhase !== "DOUBLEELIM") {
      return {
        allowed: false,
        state,

        message:
          `❌ Aktualna faza to **${currentPhase}** — ` +
          "typowanie Double Elim jest niedostępne.",
      };
    }

    return {
      allowed: true,
      state,
    };
  }

  // ==================================================
  // NIEZNANY TYP
  // ==================================================
  //
  // Fail closed — lepiej odrzucić nieznany typ,
  // niż przypadkiem pozwolić na zapis.
  // ==================================================

  logError("protections", "Unknown prediction kind", {
    guildId,
    kind,
    stage,
    currentPhase,
  });

  return {
    allowed: false,
    state,

    message: "❌ Nie udało się rozpoznać rodzaju typowania.",
  };
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  assertPredictionsAllowed,
  getPredictionEventState,
  swissStageToPhase,
  normalizePhase,
};
