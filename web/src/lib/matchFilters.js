import { humanPhase } from "./phaseLabels.js";

// Filtrowanie listy meczów: po fazie, po drużynie i po stanie.
//
// Wszystko liczy się na miejscu, z listy, która i tak została pobrana -
// turniej ma dziś najwyżej sto sześć meczów, więc filtrowanie po stronie
// serwera byłoby zapytaniem za każdym kliknięciem po nic.

/**
 * Stan meczu, wyliczony z tych samych pól, których lista używa w stopce.
 *
 * Celowo NIE z wyliczanki wartości `ui_status`: w bazie widać dziś tylko
 * FINAL i LOCKED, bo wszystkie trzy turnieje są zakończone, a jak nazywa się
 * stan meczu w trakcie - nie wiadomo. Te trzy przypadki wynikają z pól,
 * których znaczenie jest pewne, i obsłużą każdą nową wartość `ui_status`.
 */
export function matchState(match) {
  if (match?.ui_status === "FINAL") return "finished";

  if (match?.predictions_allowed === false) return "locked";

  return "open";
}

// Klucze podane wprost, nie sklejane - ta sama zasada co przy klasach CSS,
// a przy okazji to jest miejsce, w którym widać wszystkie możliwe stany naraz.
export const STATE_KEYS = {
  open: "matchState.open",
  locked: "matchState.locked",
  finished: "matchState.finished",
};

/**
 * Nazwy drużyn występujące w tych meczach, alfabetycznie.
 *
 * Bez sklejania zapisów: lista pochodzi z tych samych meczów, po których
 * potem filtrujemy, więc porównanie dokładnego napisu zawsze trafi. Dopisanie
 * tu normalizacji rozjechałoby wybór z filtrem.
 */
export function teamsFromMatches(matches) {
  const nazwy = new Set();

  for (const m of matches || []) {
    if (m?.team_a) nazwy.add(m.team_a);
    if (m?.team_b) nazwy.add(m.team_b);
  }

  return [...nazwy].sort((a, b) => a.localeCompare(b, "pl"));
}

/**
 * Fazy występujące w tych meczach, z etykietami do pokazania.
 *
 * API oddaje fazy wielkimi literami (PLAYIN, DOUBLEELIM), a etykiety są
 * pisane małymi - stąd humanPhase, które sprowadza jedno do drugiego.
 */
export function phasesFromMatches(matches, t) {
  const fazy = new Set();

  for (const m of matches || []) {
    if (m?.phase) fazy.add(m.phase);
  }

  return [...fazy].map((phase) => ({ phase, label: humanPhase(phase, t) }));
}

// Porównanie faz odporne na wielkość liter. Adres może nieść "playin",
// a mecz "PLAYIN" - to ta sama faza i filtr ma to widzieć.
function tenSamEtap(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

// Kolejność stanów na liście: najpierw to, co da się jeszcze obstawić.
//
// Lista szła dotąd po numerze meczu, czyli w kolejności rozgrywania - a to
// znaczy, że im dalej w turniej, tym więcej rozegranych spotkań trzeba
// przewinąć, zanim zobaczy się cokolwiek otwartego. Przy 33 meczach etapu
// i 30 rozstrzygniętych otwarte wisiały na samym dole.
const KOLEJNOSC_STANOW = { open: 0, locked: 1, finished: 2 };

/**
 * Mecze ułożone stanem, a w obrębie stanu po numerze.
 *
 * Nie zmienia zawartości listy - samą kolejność. Filtr po stanie działa
 * dalej tak samo i nadal pozwala zawęzić widok do jednej grupy.
 */
export function sortMatches(matches) {
  return [...(matches || [])].sort((a, b) => {
    const sa = KOLEJNOSC_STANOW[matchState(a)] ?? 9;
    const sb = KOLEJNOSC_STANOW[matchState(b)] ?? 9;

    if (sa !== sb) return sa - sb;

    // Numer meczu bywa pusty - takie mecze lądują na końcu swojej grupy.
    //
    // Pustkę trzeba odrzucić PRZED Number(): `Number(null)` to zero, a nie
    // NaN, więc mecz bez numeru wskakiwałby na samą górę zamiast na dół.
    const numer = (m) => {
      const surowy = m?.match_no;

      if (surowy === null || surowy === undefined || surowy === "") return 1e9;

      const n = Number(surowy);

      return Number.isFinite(n) ? n : 1e9;
    };

    const na = numer(a);
    const nb = numer(b);

    return na - nb || Number(a?.id ?? 0) - Number(b?.id ?? 0);
  });
}

/**
 * Odsiewa mecze według wybranych filtrów.
 *
 * Pusta albo brakująca wartość filtru znaczy "wszystkie" - dzięki temu adres
 * bez parametrów daje pełną listę i nie trzeba nic zerować.
 */
export function filterMatches(matches, { phase, team, state } = {}) {
  return (matches || []).filter((m) => {
    if (phase && !tenSamEtap(m?.phase, phase)) return false;

    if (team && m?.team_a !== team && m?.team_b !== team) return false;

    if (state && matchState(m) !== state) return false;

    return true;
  });
}
