const { getTournamentState } = require('./tournamentState');

// Mapujemy "stage1" -> "SWISS_STAGE_1" itd.
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
 * Sprawdza czy użytkownik może typować w danym "kontekście".
 *
 * Ważne: jeżeli tabela tournament_state nie istnieje, NIE BLOKUJEMY
 * (żeby nie rozwalić produkcji/starych baz).
 */
async function assertPredictionsAllowed({ guildId, kind, stage }) {
  const state = await getTournamentState(guildId);
  const phase = normalizePhase(state.phase);

  // Brak tabeli -> przepuszczamy (kompatybilność)
  if (!state.exists) {
    return { allowed: true, state: { ...state, phase } };
  }

  if (!state.isOpen) {
    return {
      allowed: false,
      state: { ...state, phase },
      message: '❌ Typowanie jest aktualnie **zamknięte**.'
    };
  }

  const k = String(kind || '').toUpperCase();

  if (k === 'SWISS') {
    const expected = swissStageToPhase(stage);
    if (!['SWISS_STAGE_1', 'SWISS_STAGE_2', 'SWISS_STAGE_3'].includes(phase)) {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza turnieju to **${phase}** — typowanie Swiss jest teraz niedostępne.`
      };
    }
    if (expected && phase !== expected) {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza Swiss to **${phase}** — ten panel jest dla **${expected}**.`
      };
    }
    return { allowed: true, state: { ...state, phase } };
  }

  if (k === 'PLAYOFFS') {
    if (phase !== 'PLAYOFFS') {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza turnieju to **${phase}** — typowanie Playoffs jest teraz niedostępne.`
      };
    }
    return { allowed: true, state: { ...state, phase } };
  }

  if (k === 'PLAYIN') {
    if (phase !== 'PLAYIN') {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza turnieju to **${phase}** — typowanie Play-In jest teraz niedostępne.`
      };
    }
    return { allowed: true, state: { ...state, phase } };
  }

  if (k === 'DOUBLE_ELIM' || k === 'DOUBLEELIM' || k === 'DOUBLE') {
    if (phase !== 'DOUBLE_ELIM') {
      return {
        allowed: false,
        state: { ...state, phase },
        message: `❌ Aktualna faza turnieju to **${phase}** — typowanie Double Elim jest teraz niedostępne.`
      };
    }
    return { allowed: true, state: { ...state, phase } };
  }

  // domyślnie nie blokujemy
  return { allowed: true, state: { ...state, phase } };
}

module.exports = {
  assertPredictionsAllowed,
  swissStageToPhase,
  normalizePhase,
};
