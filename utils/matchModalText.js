// Napisy modali dokladnego wyniku - zlozone tak, zeby nie dalo sie przekroczyc
// limitu Discorda, bez wzgledu na to, jak dluga jest nazwa druzyny.
//
// Trzy miejsca budowaly te same napisy przez wstawienie nazw w szablon
// (handlers/matches/matchUserExactOpen, matchAdminExactOpen,
// matchAdminExactSubmit) i przy parze dluzszej niz 25 znakow modal nie
// otwieral sie wcale.

const { getMapLabel } = require("./mapLabels");
const { LIMITS, truncate, truncatePair } = require("./discordLimits");

const BO1_PREFIX = "Dokładny wynik: ";
const VERSUS = " vs ";
const MAP_PREFIX = "Dokładny wynik — ";
const OFFICIAL_PREFIX = "Oficjalny dokładny wynik";

const SCORE_SUFFIX = " — wynik";

// Tytul modala gracza. W BO1 nosi obie nazwy, w BO3/BO5 etykiete mapy
// ("Pick <druzyna>" / "Decider"), bo to ona mowi, ktory wynik sie wpisuje.
function playerPickTitle({ maxMaps, mapNo, bestOf, teamA, teamB }) {
  if (Number(maxMaps) === 1) {
    const budget = LIMITS.MODAL_TITLE - BO1_PREFIX.length - VERSUS.length;

    const [a, b] = truncatePair(teamA, teamB, budget);

    if (!a && !b) return BO1_PREFIX.replace(/:\s*$/, "");

    return `${BO1_PREFIX}${a}${VERSUS}${b}`;
  }

  const label = getMapLabel(mapNo, bestOf, teamA, teamB);

  return truncate(`${MAP_PREFIX}${label}`, LIMITS.MODAL_TITLE);
}

// Tytul modala administratora. Swiadomie bez nazw druzyn - getMapLabel bez
// nich oddaje "Pick Team A", a nazwy i tak sa na etykietach pol.
function officialResultTitle({ maxMaps, mapNo, bestOf }) {
  if (Number(maxMaps) === 1) return OFFICIAL_PREFIX;

  return truncate(
    `${OFFICIAL_PREFIX} — ${getMapLabel(mapNo, bestOf)}`,
    LIMITS.MODAL_TITLE,
  );
}

// Etykieta pola z wynikiem jednej druzyny. Przyrostek bywa dluzszy
// (np. " — wynik (np. 13)"), wiec budzet na nazwe liczy sie od niego.
function scoreFieldLabel(name, suffix = SCORE_SUFFIX) {
  const tail = String(suffix ?? "");

  const head = truncate(name, LIMITS.FIELD_LABEL - tail.length);

  return head ? `${head}${tail}` : "Wynik";
}

module.exports = {
  SCORE_SUFFIX,
  playerPickTitle,
  officialResultTitle,
  scoreFieldLabel,
};
