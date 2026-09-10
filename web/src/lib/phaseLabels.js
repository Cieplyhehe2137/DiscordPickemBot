// Odpowiednik humanPhase() z utils/phase.js po stronie frontu.
//
// events.phase i matches.phase trzymają surowe identyfikatory w kilku
// wariantach zapisu naraz (SWISS_STAGE_1, swiss_stage1, DOUBLE_ELIM,
// NOT_STARTED). Bez mapowania trafiały one na ekran w tej postaci.

const ETYKIETY = {
  not_started: "Nie rozpoczęty",
  finished: "Zakończony",

  swiss: "Swiss",
  swiss_stage1: "Swiss Stage 1",
  swiss_stage2: "Swiss Stage 2",
  swiss_stage3: "Swiss Stage 3",

  stage1: "Swiss Stage 1",
  stage2: "Swiss Stage 2",
  stage3: "Swiss Stage 3",

  playoffs: "Playoffs",
  playin: "Play-In",
  doubleelim: "Double Elimination",
};

// Sprowadza wariant zapisu do jednego klucza: małe litery, spacje i myślniki
// na podkreślenia, a potem usunięcie podkreślenia przed cyfrą etapu
// (swiss_stage_1 -> swiss_stage1) oraz w nazwach faz (double_elim -> doubleelim).
function normalizuj(phase) {
  const value = String(phase || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_(\d)$/, "$1");

  if (value === "double_elim" || value === "double_elimination") {
    return "doubleelim";
  }

  if (value === "play_in") return "playin";

  return value;
}

export function humanPhase(phase) {
  if (!phase) return "—";

  const klucz = normalizuj(phase);

  return ETYKIETY[klucz] || phase;
}

// Etykieta fazy używana w adresach frontu (stage1, playin, playoffs...).
export function phaseRouteLabel(routePhase) {
  return ETYKIETY[String(routePhase || "").toLowerCase()] || routePhase;
}
