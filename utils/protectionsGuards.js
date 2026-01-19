const { getTournamentState } = require('./tournamentState');

// Mapujemy "stage1" -> "SWISS_STAGE_1"
function swissStageToPhase(stage) {
  const s = String(stage || '').toLowerCase();
  if (s === 'stage1') return 'SWISS_STAGE_1';
  if (s === 'stage2') return 'SWISS_STAGE_2';
  if (s === 'stage3') return 'SWISS_STAGE_3';
  return null;
}

function normalizePhase(phase) {
  return String(phase || '').trim().toUpperCase();
}

/**
 * Sprawdza czy użytkownik może typować w danym "kind".
 * Tabela tournament_state jest GLOBALNA (bez guild_id).
 */
async function assertPredictionsAllowed({ kind, stage }) {
  const state = await getTournamentState(); 
  const phase = normalizePhase(state.phase);

  // Jeśli tabela nie istnieje lub jest pusta → PRZEPUŚĆ
  if (!state.exists) {
    return { allowed: true, state: { ...state, phase } };
  }

  // Globalny przełącznik otwarte/zamknięte
  if (!state.is_open) {
    return {
      allowed: false,
      state: { ...state, phase },
      message: '❌ Typowanie jest aktualnie **zamknięte**.'
    };
  }

  const k = String(kind || '').toUpperCase();

  // SWISS
  if (k === 'SWISS') {
    const expected = swissStageToPhase(stage);

    if (!['SWISS_STAGE_1', 'SWISS_STAGE_2', 'SWISS_STAGE_3'].includes(phase)) {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza to **${phase}** — typowanie Swiss jest niedostępne.`
      };
    }

    if (expected && phase !== expected) {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Ten panel jest dla **${expected}**, a aktualna faza to **${phase}**.`
      };
    }

    return { allowed: true, state: { ...state, phase } };
  }

  // PLAYOFFS
  if (k === 'PLAYOFFS') {
    if (phase !== 'PLAYOFFS') {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza to **${phase}** — typowanie Playoffs jest niedostępne.`
      };
    }
    return { allowed: true, state: { ...state, phase } };
  }

  // PLAY-IN
  if (k === 'PLAYIN') {
    if (phase !== 'PLAYIN') {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza to **${phase}** — typowanie Play-In jest niedostępne.`
      };
    }
    return { allowed: true, state: { ...state, phase } };
  }

  // DOUBLE ELIM
  if (['DOUBLE_ELIM', 'DOUBLEELIM', 'DOUBLE'].includes(k)) {
    if (phase !== 'DOUBLE_ELIM') {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza to **${phase}** — typowanie Double Elim jest niedostępne.`
      };
    }
    return { allowed: true, state: { ...state, phase } };
  }

  // Domyślnie pozwalamy
  return { allowed: true, state: { ...state, phase } };
}

module.exports = {
  assertPredictionsAllowed,
  swissStageToPhase,
  normalizePhase,
};
