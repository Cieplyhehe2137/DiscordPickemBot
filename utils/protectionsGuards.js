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

    // MATCHES
    matches: "MATCHES",
    match: "MATCHES",

    // Generic Swiss identifier.
    swiss: "SWISS",
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
      "swiss_stage_1".replace("1", "2"),
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
// ACTIVE PANEL PHASE
// ======================================================
//
// active_panels.phase przechowuje faktyczne wartości:
//
// swiss_stage1
// swiss_stage2
// swiss_stage3
// playoffs
// doubleelim
// playin
//
// Publiczny handler Swiss może natomiast przekazać:
//
// phase = "swiss"
// stage = "stage1"
//
// dlatego tutaj tłumaczymy to na właściwą fazę DB.
// ======================================================

function resolvePanelPhase(phase, stage = null) {
  const normalizedPhase = normalizePhase(phase);

  if (normalizedPhase === "SWISS") {
    const swissPhase = swissStageToPhase(stage);

    if (!swissPhase) {
      return null;
    }

    return swissPhase.toLowerCase();
  }

  return normalizedPhase.toLowerCase();
}

// ======================================================
// EVENT STATE
// ======================================================

async function getPredictionEventState(guildId) {
  if (!guildId) {
    return {
      exists: false,
      isOpen: false,
      isActive: false,
      phase: "UNKNOWN",
      eventId: null,
      eventName: null,
      status: null,
      error: "Missing guildId",
    };
  }

  try {
    return await withGuild(guildId, async ({ pool }) => {
      // ================================================
      // SINGLE SOURCE OF TRUTH
      // ================================================
      //
      // Event jest aktywny tylko wtedy, gdy wszystkie
      // trzy pola lifecycle są zgodne.
      //
      // Nie stosujemy już:
      //
      // is_active = 1
      // OR is_open = 1
      // OR status = 'OPEN'
      //
      // ponieważ taki fallback mógł wybrać event ze
      // starym / niespójnym stanem.
      // ================================================

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
          AND status = 'OPEN'
          AND is_open = 1
          AND is_active = 1
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId],
      );

      if (!event) {
        return {
          exists: false,
          isOpen: false,
          isActive: false,
          phase: "UNKNOWN",
          eventId: null,
          eventName: null,
          status: null,
        };
      }

      return {
        exists: true,

        eventId: Number(event.id),

        eventName: event.name || null,

        phase: normalizePhase(event.phase),

        status: String(event.status || "").toUpperCase(),

        // Query już wymusił te warunki.
        isOpen: true,

        isActive: true,
      };
    });
  } catch (err) {
    logError("protections", "getPredictionEventState failed", {
      guildId,
      message: err?.message,
      stack: err?.stack,
    });

    // Fail closed.
    return {
      exists: false,
      isOpen: false,
      isActive: false,
      phase: "UNKNOWN",
      eventId: null,
      eventName: null,
      status: null,
      error: err?.message || "Unknown error",
    };
  }
}

// ======================================================
// CORE PREDICTION GUARD
// ======================================================

async function assertPredictionsAllowed({ guildId, kind, stage = null }) {
  const state = await getPredictionEventState(guildId);

  // ==================================================
  // NO ACTIVE EVENT
  // ==================================================

  if (!state.exists) {
    return {
      allowed: false,
      state,

      message: "❌ Brak aktywnego eventu Pick'Em.",
    };
  }

  // ==================================================
  // EXTRA FAIL-CLOSED CHECK
  // ==================================================
  //
  // Normalnie ten przypadek nie powinien wystąpić,
  // ponieważ getPredictionEventState() już wymaga:
  //
  // OPEN + is_open=1 + is_active=1
  // ==================================================

  if (!state.isOpen || !state.isActive) {
    return {
      allowed: false,
      state,

      message: "❌ Typowanie jest aktualnie **zamknięte**.",
    };
  }

  const currentPhase = normalizePhase(state.phase);

  const requestedKind = normalizePhase(kind);

  // ==================================================
  // MATCHES
  // ==================================================
  //
  // Typy meczowe mają własny lock / deadline.
  //
  // Tutaj pilnujemy tylko tego, żeby istniał prawidłowo
  // aktywny event.
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

    // Jeśli handler Swiss przekazał stage, ale jest on
    // nieprawidłowy, blokujemy akcję.
    if (stage && !expectedPhase) {
      return {
        allowed: false,
        state,

        message: "❌ Nieprawidłowy etap Swiss.",
      };
    }

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
  // UNKNOWN TYPE
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
// ACTIVE PUBLIC PANEL GUARD
// ======================================================
//
// Ten guard jest przeznaczony WYŁĄCZNIE dla publicznego
// panelu opublikowanego przez pickemPanelPublisher.
//
// Nie używamy go na ephemeral dropdownach / confirmach,
// ponieważ mają inne message_id.
// ======================================================

async function assertActivePredictionPanel({
  pool,
  guildId,
  messageId,
  phase,
  stage = null,
}) {
  if (!pool || !guildId || !messageId || !phase) {
    return {
      allowed: false,

      message: "❌ Nie udało się zweryfikować panelu Pick'Em.",
    };
  }

  // ==================================================
  // RESOLVE DB PHASE
  // ==================================================

  const dbPhase = resolvePanelPhase(phase, stage);

  if (!dbPhase) {
    return {
      allowed: false,

      message: "❌ Nie udało się rozpoznać fazy tego panelu.",
    };
  }

  // ==================================================
  // STAGE
  // ==================================================

  const normalizedStage = stage ? normalizeStage(stage) : null;

  if (stage && !normalizedStage) {
    return {
      allowed: false,

      message: "❌ Nieprawidłowy etap Swiss.",
    };
  }

  // W active_panels.stage publisher przechowuje
  // config.stage, czyli np. "stage1".
  const dbStage = normalizedStage ? normalizedStage.toLowerCase() : null;

  // ==================================================
  // QUERY
  // ==================================================

  const params = [guildId, String(messageId), dbPhase];

  let stageCondition = "";

  if (dbStage) {
    stageCondition = "AND stage = ?";
    params.push(dbStage);
  }

  const [rows] = await pool.query(
    `
    SELECT
      id,
      message_id,
      channel_id,
      phase,
      stage,
      active,
      closed
    FROM active_panels
    WHERE guild_id = ?
      AND message_id = ?
      AND phase = ?
      ${stageCondition}
      AND active = 1
      AND COALESCE(closed, 0) = 0
    LIMIT 1
    `,
    params,
  );

  if (!rows.length) {
    return {
      allowed: false,

      message:
        "❌ Ten panel Pick'Em nie jest już aktywny.\n" +
        "Użyj najnowszego panelu opublikowanego na serwerze.",
    };
  }

  return {
    allowed: true,

    panel: rows[0],
  };
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  assertPredictionsAllowed,
  assertActivePredictionPanel,
  getPredictionEventState,
  swissStageToPhase,
  normalizeStage,
  normalizePhase,
  resolvePanelPhase,
};
