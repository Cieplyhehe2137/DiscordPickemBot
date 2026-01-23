const { getTournamentState } = require('./tournamentState');

/* =========================
   NORMALIZACJE
   ========================= */

function normalizePhase(phase) {
  return String(phase || '')
    .trim()
    .toUpperCase()
    .replace('-', '_');
}

function normalizeStage(stage) {
  const s = String(stage || '').toLowerCase().trim();

  if (['1', 'stage1', 'swiss1', 'swiss_1'].includes(s)) return 'STAGE1';
  if (['2', 'stage2', 'swiss2', 'swiss_2'].includes(s)) return 'STAGE2';
  if (['3', 'stage3', 'swiss3', 'swiss_3'].includes(s)) return 'STAGE3';

  return null;
}

function swissStageToPhase(stage) {
  const st = normalizeStage(stage);
  if (st === 'STAGE1') return 'SWISS_STAGE_1';
  if (st === 'STAGE2') return 'SWISS_STAGE_2';
  if (st === 'STAGE3') return 'SWISS_STAGE_3';
  return null;
}

/* =========================
   CORE
   ========================= */

/**
 * Sprawdza czy użytkownik może typować.
 * UWAGA: tournament_state jest GLOBALNY (bez guild_id).
 */
async function assertPredictionsAllowed({ kind, stage }) {
  const state = await getTournamentState();
  const phase = normalizePhase(state.phase);

  // fallback safety
  if (!state.exists) {
    return { allowed: true, state: { ...state, phase } };
  }

  if (!state.is_open) {
    return {
      allowed: false,
      state: { ...state, phase },
      message: '❌ Typowanie jest aktualnie **zamknięte**.',
    };
  }

  const k = normalizePhase(kind);

  /* ===== SWISS ===== */
  if (k === 'SWISS') {
    const expected = swissStageToPhase(stage);

    if (!phase.startsWith('SWISS_STAGE_')) {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza to **${phase}** — typowanie Swiss jest niedostępne.`,
      };
    }

    if (expected && phase !== expected) {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Ten panel jest dla **${expected}**, a aktualna faza to **${phase}**.`,
      };
    }

    return { allowed: true, state: { ...state, phase } };
  }

  /* ===== PLAYOFFS ===== */
  if (k === 'PLAYOFFS') {
    if (phase !== 'PLAYOFFS') {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza to **${phase}** — typowanie Playoffs jest niedostępne.`,
      };
    }
    return { allowed: true, state: { ...state, phase } };
  }

  /* ===== PLAY-IN ===== */
  if (k === 'PLAYIN') {
    if (phase !== 'PLAYIN') {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza to **${phase}** — typowanie Play-In jest niedostępne.`,
      };
    }
    return { allowed: true, state: { ...state, phase } };
  }

  /* ===== DOUBLE ELIM ===== */
  if (['DOUBLE', 'DOUBLEELIM', 'DOUBLE_ELIM'].includes(k)) {
    if (phase !== 'DOUBLE_ELIM') {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza to **${phase}** — typowanie Double Elim jest niedostępne.`,
      };
    }
    return { allowed: true, state: { ...state, phase } };
  }

  // fallback
  return { allowed: true, state: { ...state, phase } };
}

module.exports = {
  assertPredictionsAllowed,
  swissStageToPhase,
  normalizePhase,
};
