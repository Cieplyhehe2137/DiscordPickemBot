// Kiedy typowanie jest otwarte.
//
// Dwie reguly, obie o pierwszenstwie powodow blokady - i wlasnie kolejnosc jest
// tu trescia, bo z niej wynika, ktory komunikat zobaczy gracz.
//
// resolveMatchPredictionState dolicza do wiersza meczu to, czego nie da sie
// policzyc w SQL: globalny gate turnieju, blokade meczu i deadline meczowy fazy.
//
// checkPickemGate laczy stan turnieju z deadlinem panelu. Discord pilnuje
// terminow, wygaszajac komponenty wiadomosci - API tego nie widzi, wiec ten sam
// warunek musi byc sprawdzony po stronie serwera, inaczej zapis z WWW
// przechodzilby po czasie.
//
// Zaleznosci argumentem, zeby obie dalo sie sprawdzic bez bazy i bez Discorda.

export function createPredictionGate({
  pool,
  assertPredictionsAllowed,
  isPickDeadlinePassed,
  isMatchDeadlinePassed,
  isMatchLocked,
  matchPanelPhaseFor,
  toWebMessage,
  pickemPanelPhase,
}) {
  // Dolicza do wiersza meczu to, czego nie da sie policzyc w SQL:
  // globalny gate turnieju, blokade meczu i deadline meczowy fazy.
  //
  // deadlineCache trzyma obietnice per faza panelu - lista 106 meczow pyta
  // wtedy o deadline raz na faze, a nie raz na mecz.
  async function resolveMatchPredictionState({ match, gate, guildId, deadlineCache }) {
    const base = {
      ...match,
      saved_maps: Number(match.saved_maps || 0),
    };

    if (match.ui_status === "FINAL") {
      return {
        ...base,
        predictions_allowed: false,
        lock_reason: "Mecz został zakończony.",
        ui_status: "FINAL",
      };
    }

    if (!gate.allowed) {
      return {
        ...base,
        predictions_allowed: false,
        lock_reason: toWebMessage(
          gate.message,
          "Typowanie meczów jest aktualnie zamknięte.",
        ),
        ui_status: "LOCKED",
      };
    }

    if (isMatchLocked(match)) {
      return {
        ...base,
        predictions_allowed: false,
        lock_reason: "Mecz jest zablokowany.",
        ui_status: "LOCKED",
      };
    }

    const matchPanelPhase = matchPanelPhaseFor(match.phase);

    if (matchPanelPhase) {
      if (!deadlineCache.has(matchPanelPhase)) {
        deadlineCache.set(
          matchPanelPhase,
          isMatchDeadlinePassed(pool, guildId, matchPanelPhase),
        );
      }

      const { passed } = await deadlineCache.get(matchPanelPhase);

      if (passed) {
        return {
          ...base,
          predictions_allowed: false,
          lock_reason: "Deadline typowania wyników meczów dla tej fazy minął.",
          ui_status: "LOCKED",
        };
      }
    }

    return {
      ...base,
      predictions_allowed: true,
      lock_reason: null,
      ui_status: "OPEN",
    };
  }

  // Tournament-state gate + panel deadline gate in one place. Discord only
  // enforces deadlines by disabling message components, which the web API
  // never sees - this adds the equivalent server-side block for web saves.
  async function checkPickemGate(guildId, kind, stage = null) {
    const gate = await assertPredictionsAllowed({ guildId, kind, stage });

    if (!gate.allowed) return gate;

    const { passed } = await isPickDeadlinePassed(
      pool,
      guildId,
      pickemPanelPhase[kind],
      stage,
    );

    if (passed) {
      return {
        allowed: false,
        message: "Deadline typowania dla tej fazy minął.",
      };
    }

    return gate;
  }

  return { resolveMatchPredictionState, checkPickemGate };
}
