// Wynik turnieju: kto go wygrał i ilu to przewidziało.
//
// Można było otworzyć stronę IEM Cologne Major 2026 i NIE DOWIEDZIEĆ SIĘ,
// kto ten turniej wygrał. Mistrz leży w playoffs_results od początku, ale
// pokazywał go wyłącznie komponent PhaseResults - montowany na stronach
// TYPOWANIA fazy, czyli tam, gdzie wchodzi się przez „obstaw playoffy",
// i w kontekście „Twój typ wobec poprawnej odpowiedzi". Kto nie typował
// playoffów, nie miał po co tam iść.
//
// A liczby są tego warte. Zmierzone na produkcji:
//
//   IEM Cologne Major 2026    mistrz Falcons     trafiło  4 z  99  ( 4%)
//                             faworyt tłumu: Spirit 42%, Vitality 33%
//   StarLadder Budapest 2025  mistrz Vitality    trafiło 22 z 218  (10%)
//                             faworyt tłumu: Furia 57% - i nie weszła do finału
//   IEM Kraków 2026           mistrz Vitality    trafiło 39 z  49  (80%)
//
// Cologne wygrała drużyna, na którą postawiło 4% ludzi. W Budapeszcie
// 57-procentowy faworyt odpadł przed finałem. W Krakowie społeczność
// trafiła bez wahania. Trzy turnieje, trzy zupełnie różne historie.

import { teamKey } from "./teamLogos.js";

/**
 * Znaki, którymi administrator zapisuje „nie ma trzeciego miejsca".
 *
 * Trzy turnieje, trzy różne zapisy tego samego: Cologne ma „—", Budapeszt
 * NULL, a Kraków prawdziwą nazwę. Bez tego filtra myślnik trafiłby na
 * stronę jako nazwa drużyny - z logotypem i literą „—" w kółku.
 */
const MYSLNIKI = /^[\s\-–—−]*$/;

function nazwaAlbo(wartosc) {
  const s = String(wartosc ?? "").trim();

  if (!s || MYSLNIKI.test(s)) return null;

  return s;
}

/** Lista drużyn z pola tekstowego: "FURIA, Falcons" albo "[\"A\",\"B\"]". */
function lista(wartosc) {
  if (!wartosc) return [];

  return String(wartosc)
    .replace(/[[\]"]+/g, "")
    .split(/[;,]+/)
    .map((s) => s.trim())
    .filter((s) => s && !MYSLNIKI.test(s));
}

function procent(ile, z) {
  return z > 0 ? Math.round((100 * ile) / z) : 0;
}

/**
 * Drużyna gotowa do pokazania: nazwa plus logotyp.
 *
 * Logotyp wiąże się przez teamKey, a nie przez samą nazwę - w bazie stoi
 * wolny tekst i te same drużyny bywają zapisane różnie („FaZe Clan" obok
 * „Faze Clan", „PARIVISION" obok „Parivision").
 */
function druzyna(nazwa, logotypy) {
  const czysta = nazwaAlbo(nazwa);

  if (!czysta) return null;

  return {
    name: czysta,
    logo: logotypy.get(teamKey(czysta)) ?? null,
  };
}

/**
 * Składa wynik turnieju i trafność społeczności.
 *
 * @param result      wiersz playoffs_results albo null, gdy turniej nie ma
 *                    jeszcze rozstrzygnięcia
 * @param predictions typy playoffów: winner, finalists, semifinalists
 * @param logos       [{ name_key, logo_url }]
 */
export function buildOutcome(result, predictions, { logos = [] } = {}) {
  const logotypy = new Map();

  for (const l of logos || []) {
    if (l?.name_key && l?.logo_url) logotypy.set(l.name_key, l.logo_url);
  }

  const mistrz = druzyna(result?.correct_winner, logotypy);

  // Bez mistrza nie ma o czym mówić. Turniej w trakcie ma wiersz wyników
  // dopiero wtedy, gdy administrator go wpisze - do tego czasu sekcja
  // nie istnieje, a to jest stan normalny, nie awaria.
  if (!mistrz) {
    return {
      settled: false,
      winner: null,
      runner_up: null,
      lost_semis: [],
      third_place: null,
      total: 0,
      called: { winner: 0, finalists: 0, semifinalists: 0 },
      called_percent: { winner: 0, finalists: 0, semifinalists: 0 },
      favourite: null,
    };
  }

  const finalisci = lista(result.correct_finalists);
  const polfinalisci = lista(result.correct_semifinalists);

  const kluczMistrza = teamKey(mistrz.name);

  // Przegrany finalista: ten z dwójki, który nie jest mistrzem. Dzięki temu
  // strona może napisać „Falcons pokonali FURIĘ" zamiast wyliczanki.
  const przegranyFinalu =
    finalisci.map((n) => druzyna(n, logotypy)).find(
      (d) => d && teamKey(d.name) !== kluczMistrza,
    ) ?? null;

  const kluczeFinalistow = new Set(finalisci.map((n) => teamKey(n)));

  const kluczePolfinalistow = polfinalisci.map((n) => teamKey(n));

  const trzecieMiejsce = druzyna(result.correct_third_place_winner, logotypy);

  // Półfinaliści, o których inaczej nikt by nie wspomniał: bez finalistów
  // i BEZ zdobywcy trzeciego miejsca, jeśli jest znany.
  //
  // Bez tego drugiego warunku ta sama drużyna stała w sekcji dwa razy:
  // na IEM Kraków 2026 Spirit jest trzeci i jednocześnie przegrał półfinał,
  // więc czytało się „trzecie miejsce: Spirit" tuż nad „półfinaliści:
  // Spirit, MOUZ".
  const kluczTrzeciego = trzecieMiejsce ? teamKey(trzecieMiejsce.name) : null;

  const przegraniPolfinalu = polfinalisci
    .filter((n) => !kluczeFinalistow.has(teamKey(n)))
    .filter((n) => teamKey(n) !== kluczTrzeciego)
    .map((n) => druzyna(n, logotypy))
    .filter(Boolean);

  const typy = predictions || [];

  let trafiliMistrza = 0;
  let trafiliFinal = 0;
  let trafiliPolfinal = 0;

  // Kto na kogo stawiał - grupowane po kluczu, bo „Furia" i „FURIA" to ta
  // sama drużyna, a policzone osobno dałyby dwóch mniejszych faworytów
  // zamiast jednego prawdziwego.
  const naMistrza = new Map();

  for (const t of typy) {
    const mojMistrz = nazwaAlbo(t?.winner);

    if (mojMistrz) {
      const k = teamKey(mojMistrz);

      if (k === kluczMistrza) trafiliMistrza += 1;

      let wpis = naMistrza.get(k);

      if (!wpis) {
        wpis = { key: k, count: 0, zapisy: new Map() };
        naMistrza.set(k, wpis);
      }

      wpis.count += 1;

      // Zliczamy KAŻDY zapis osobno, żeby dało się potem wybrać ten, którym
      // posługuje się większość. Reguła „najdłuższy wygrywa", używana przy
      // typach drużyn na profilu gracza, nie działa tu wcale: „Furia"
      // i „FURIA" mają tyle samo znaków, więc zostawałby zapis, który baza
      // akurat zwróciła pierwszy - a ta kolejność nie jest niczym ustalona.
      wpis.zapisy.set(mojMistrz, (wpis.zapisy.get(mojMistrz) ?? 0) + 1);
    }

    const mojeFinaly = new Set(lista(t?.finalists).map((n) => teamKey(n)));

    if (
      kluczeFinalistow.size > 0 &&
      [...kluczeFinalistow].every((k) => mojeFinaly.has(k))
    ) {
      trafiliFinal += 1;
    }

    const mojePolfinaly = new Set(lista(t?.semifinalists).map((n) => teamKey(n)));

    if (
      kluczePolfinalistow.length > 0 &&
      kluczePolfinalistow.every((k) => mojePolfinaly.has(k))
    ) {
      trafiliPolfinal += 1;
    }
  }

  const wszystkich = typy.length;

  // Faworyt: najczęściej typowany mistrz. Przy remisie wygrywa nazwa
  // wcześniejsza alfabetycznie, żeby kolejność nie zależała od tego,
  // w jakiej kolejności baza zwróciła wiersze.
  const faworytWpis =
    [...naMistrza.values()].sort(
      (a, b) => b.count - a.count || (a.key < b.key ? -1 : 1),
    )[0] ?? null;

  // Zapis, którym posługuje się najwięcej osób; przy remisie wcześniejszy
  // alfabetycznie. Dzięki temu pokazana nazwa nie zależy od kolejności
  // wierszy i nie zmienia się między odświeżeniami.
  const zapisWiekszosci = faworytWpis
    ? [...faworytWpis.zapisy.entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
    )[0][0]
    : null;

  const faworyt = faworytWpis
    ? {
      ...druzyna(zapisWiekszosci, logotypy),
      count: faworytWpis.count,
      percent: procent(faworytWpis.count, wszystkich),

      // Czy tłum postawił na tego, kto faktycznie wygrał. To jest zdanie,
      // dla którego ta sekcja w ogóle ma sens: w Krakowie prawda, w Cologne
      // i w Budapeszcie fałsz.
      was_right: faworytWpis.key === kluczMistrza,
    }
    : null;

  return {
    settled: true,

    winner: mistrz,
    runner_up: przegranyFinalu,
    lost_semis: przegraniPolfinalu,
    third_place: trzecieMiejsce,

    // Ilu w ogóle typowało playoffy - mianownik wszystkich procentów niżej.
    total: wszystkich,

    called: {
      winner: trafiliMistrza,
      finalists: trafiliFinal,
      semifinalists: trafiliPolfinal,
    },

    called_percent: {
      winner: procent(trafiliMistrza, wszystkich),
      finalists: procent(trafiliFinal, wszystkich),
      semifinalists: procent(trafiliPolfinal, wszystkich),
    },

    favourite: faworyt,
  };
}

/**
 * Skrót wyniku dla KAŻDEGO turnieju naraz - na potrzeby listy turniejów.
 *
 * Lista pokazywała same nazwy w kafelkach, więc zakończony turniej nie mówił
 * o sobie nic. Tu dochodzi jedno zdanie: kto wygrał i ilu to przewidziało.
 * Zmierzone - trzy turnieje, trzy różne historie: 4%, 10% i 80%.
 *
 * Liczy tym samym buildOutcome, co strona turnieju, tylko po kolei dla
 * każdego wiersza wyników. Osobna reguła znaczyłaby dwie liczby na jedno
 * pytanie, a lista i strona turnieju stoją o jedno kliknięcie od siebie.
 *
 * Oddaje SAM SKRÓT, nie całą drabinkę: na liście nie ma gdzie pokazać
 * półfinalistów, a przesyłanie ich byłoby ładowaniem danych na zapas.
 *
 * @param results     wiersze playoffs_results Z event_id
 * @param predictions wiersze playoffs_predictions Z event_id
 * @returns Map event_id -> { winner, called_percent, total }
 */
export function buildOutcomeByEvent(results, predictions, { logos = [] } = {}) {
  const typyEventu = new Map();

  for (const p of predictions || []) {
    const id = Number(p?.event_id);

    if (!Number.isFinite(id)) continue;

    if (!typyEventu.has(id)) typyEventu.set(id, []);

    typyEventu.get(id).push(p);
  }

  const skroty = new Map();

  for (const r of results || []) {
    const id = Number(r?.event_id);

    if (!Number.isFinite(id)) continue;

    const pelny = buildOutcome(r, typyEventu.get(id) ?? [], { logos });

    if (!pelny.settled) continue;

    skroty.set(id, {
      winner: pelny.winner,
      called_percent: pelny.called_percent.winner,
      total: pelny.total,
    });
  }

  return skroty;
}
