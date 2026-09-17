// Odpowiednik humanPhase() z utils/phase.js po stronie frontu.
//
// events.phase i matches.phase trzymają surowe identyfikatory w kilku
// wariantach zapisu naraz (SWISS_STAGE_1, swiss_stage1, DOUBLE_ELIM,
// NOT_STARTED). Bez mapowania trafiały one na ekran w tej postaci.
//
// Tablica trzyma KLUCZE słownika, nie gotowe napisy - dlatego obie funkcje
// biorą `t`. Sam moduł nic nie importuje i nie wie o Reakcie, więc nadal da
// się go wywołać z testu; to wołający ma tłumacza, bo tylko on wie, w jakim
// języku jest ta konkretna strona.

const KLUCZE = {
  not_started: "phase.notStarted",
  finished: "phase.finished",

  swiss: "phase.swiss",
  swiss_stage1: "phase.swissStage1",
  swiss_stage2: "phase.swissStage2",
  swiss_stage3: "phase.swissStage3",

  stage1: "phase.swissStage1",
  stage2: "phase.swissStage2",
  stage3: "phase.swissStage3",

  playoffs: "phase.playoffs",
  playin: "phase.playin",
  doubleelim: "phase.doubleElim",
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

export function humanPhase(phase, t) {
  if (!phase) return "—";

  const klucz = KLUCZE[normalizuj(phase)];

  // Nieznana faza wraca w swojej surowej postaci. To jedyny sensowny wynik:
  // API potrafi dołożyć etap, którego front jeszcze nie zna, a "PLAYIN_2"
  // na ekranie mówi więcej niż myślnik.
  return klucz ? t(klucz) : phase;
}

// Etykieta fazy używana w adresach frontu (stage1, playin, playoffs...).
export function phaseRouteLabel(routePhase, t) {
  const klucz = KLUCZE[String(routePhase || "").toLowerCase()];

  return klucz ? t(klucz) : routePhase;
}
