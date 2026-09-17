import { normalizeTeamName } from "./teamLogos.js";

// Typy drużyn gracza w fazach turnieju: 3-0, 0-3, awans, playoffy.
//
// Do tej pory te dane dało się zobaczyć wyłącznie na stronie fazy i wyłącznie
// dla SIEBIE - trasa phase-results czyta identyfikator z sesji. Profil gracza
// pokazywał więc jego mecze i statystyki, ale nie to, kogo obstawiał na awans.
//
// Rozbijanie list i zapytania o wyniki faz siedzą tutaj, a nie w trasie, bo
// korzystają z nich dwa miejsca naraz i bo to jedyna część, która ma reguły
// warte sprawdzenia: co jest typem, co bywa myślnikiem zamiast danych i jak
// wygląda faza bez opublikowanego wyniku.

// Nazwa etapu/fazy -> rodzaj tabel, w których leżą typy i wyniki.
export const PHASE_KINDS = {
  stage1: "swiss",
  stage2: "swiss",
  stage3: "swiss",
  playin: "playin",
  playoffs: "playoffs",
  doubleelim: "doubleelim",
};

// Etykiety kategorii - te same, których używa komponent PhaseResults na
// stronach faz. Profil ma mówić o typach tak samo jak miejsce, w którym
// się je oddaje.
//
// To są KLUCZE słownika, nie gotowe zdania: strona istnieje w pięciu
// językach, a serwer nie wie, który wybrał odwiedzający. Nazwy meczów
// drabinki double elimination zostają dosłowne - nie tłumaczy ich żaden
// język, bo tak nazywa je organizator.
const ETYKIETY = {
  three_zero: "phaseResults.teams30",
  zero_three: "phaseResults.teams03",
  advancing: "phaseResults.advancing",
  playin_teams: "phaseResults.advancingTeams",
  semifinalists: "phaseResults.semifinalists",
  finalists: "phaseResults.finalists",
  winner: "phaseResults.winner",
  third_place_winner: "phaseResults.thirdPlace",
  upper_final_a: "Upper Final A",
  lower_final_a: "Lower Final A",
  upper_final_b: "Upper Final B",
  lower_final_b: "Lower Final B",
};

// Wpisy, które są zapisem BRAKU danych, a nie nazwą drużyny. W bazie siedzi
// na przykład correct_third_place_winner = "—" dla turnieju, który nie miał
// meczu o trzecie miejsce; bez tego myślnik trafiłby na ekran jako drużyna.
const PUSTE = /^[\s\-–—_.]*$/;

/**
 * Rozbija listę drużyn zapisaną jako tekst.
 *
 * Ta sama normalizacja co w calculateScores (cleanList), żeby trafienia
 * liczyły się identycznie jak punkty. Dane bywają zapisane jako CSV albo jako
 * tablica JSON - zależnie od tego, która wersja bota je zapisała.
 */
export function splitTeamList(value) {
  if (!value) return [];

  let surowe = [];

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) surowe = parsed.map(String);
  } catch {
    // zwykły CSV
  }

  if (!surowe.length) {
    surowe = String(value)
      .replace(/[[\]"]+/g, "")
      .split(/[;,]+/);
  }

  return surowe.map((item) => item.trim()).filter((item) => !PUSTE.test(item));
}

/**
 * Składa kategorie jednej fazy w listę grup gotową dla widoku.
 *
 * Grupa bez ani jednego typu wypada - pusty nagłówek "Finaliści" bez niczego
 * pod spodem wygląda jak awaria, a nie jak informacja, że ktoś tego nie
 * obstawiał.
 */
export function buildGroups(kind, prediction, result) {
  if (!prediction) return [];

  const pary = {
    swiss: [
      ["three_zero", prediction.pick_3_0, result?.correct_3_0],
      ["zero_three", prediction.pick_0_3, result?.correct_0_3],
      ["advancing", prediction.advancing, result?.correct_advancing],
    ],
    playin: [["playin_teams", prediction.teams, result?.correct_teams]],
    playoffs: [
      ["semifinalists", prediction.semifinalists, result?.correct_semifinalists],
      ["finalists", prediction.finalists, result?.correct_finalists],
      ["winner", prediction.winner, result?.correct_winner],
      [
        "third_place_winner",
        prediction.third_place_winner,
        result?.correct_third_place_winner,
      ],
    ],
    doubleelim: [
      ["upper_final_a", prediction.upper_final_a, result?.upper_final_a],
      ["lower_final_a", prediction.lower_final_a, result?.lower_final_a],
      ["upper_final_b", prediction.upper_final_b, result?.upper_final_b],
      ["lower_final_b", prediction.lower_final_b, result?.lower_final_b],
    ],
  };

  return (pary[kind] || [])
    .map(([key, typ, poprawne]) => ({
      key,
      label: ETYKIETY[key],
      picked: splitTeamList(typ),
      correct: splitTeamList(poprawne),
    }))
    .filter((grupa) => grupa.picked.length > 0);
}

// Zapytania o jedną fazę.
//
// Wynik wybieramy przez ORDER BY active DESC, id DESC - czyli aktywny, a gdy
// takiego nie ma, najnowszy istniejący. Nie jest to pobłażliwość wobec danych,
// tylko wniosek z tego, co flaga może znaczyć:
//
// Publikowanie wyniku ZAWSZE zapisuje active = 1, a wyłączenie na 0 służy
// wyłącznie zrobieniu miejsca dla nowego wiersza. Nie istnieje nic w rodzaju
// "cofnij publikację" - usunięcie wyniku to DELETE. Klucz unikalny na
// (guild_id, event_id, stage) dopuszcza jeden wiersz na etap.
//
// Jedyny wiersz z active = 0 nie może więc być ani zastąpiony, ani wycofany:
// to zgubiona flaga. Tak wygląda dziś IEM Cologne - trzy etapy z wynikiem,
// wszystkie oznaczone jako nieaktywne, przez co strona fazy pokazuje
// "brak oficjalnego wyniku" mimo że wynik siedzi w bazie.
const ZAPYTANIA = {
  swiss: {
    prediction: `SELECT pick_3_0, pick_0_3, advancing
                   FROM swiss_predictions
                  WHERE guild_id = ? AND event_id = ? AND user_id = ? AND stage = ?
                  LIMIT 1`,
    result: `SELECT correct_3_0, correct_0_3, correct_advancing
               FROM swiss_results
              WHERE guild_id = ? AND event_id = ? AND stage = ? 
              ORDER BY active DESC, id DESC LIMIT 1`,
    points: `SELECT points FROM swiss_scores
              WHERE guild_id = ? AND event_id = ? AND user_id = ? AND stage = ?
              LIMIT 1`,
  },

  playin: {
    prediction: `SELECT teams FROM playin_predictions
                  WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
    result: `SELECT correct_teams FROM playin_results
              WHERE guild_id = ? AND event_id = ? 
              ORDER BY active DESC, id DESC LIMIT 1`,
    points: `SELECT points FROM playin_scores
              WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
  },

  playoffs: {
    prediction: `SELECT semifinalists, finalists, winner, third_place_winner
                   FROM playoffs_predictions
                  WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
    result: `SELECT correct_semifinalists, correct_finalists, correct_winner,
                    correct_third_place_winner
               FROM playoffs_results
              WHERE guild_id = ? AND event_id = ? 
              ORDER BY active DESC, id DESC LIMIT 1`,
    points: `SELECT points FROM playoffs_scores
              WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
  },

  doubleelim: {
    prediction: `SELECT upper_final_a, lower_final_a, upper_final_b, lower_final_b
                   FROM doubleelim_predictions
                  WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
    result: `SELECT upper_final_a, lower_final_a, upper_final_b, lower_final_b
               FROM doubleelim_results
              WHERE guild_id = ? AND event_id = ? 
              ORDER BY active DESC, id DESC LIMIT 1`,
    points: `SELECT points FROM doubleelim_scores
              WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
  },
};

/**
 * Wszystkie typy drużyn jednego gracza w jednym turnieju.
 *
 * Zwraca tylko te fazy, w których gracz cokolwiek obstawił - lista faz, które
 * turniej mógł mieć, jest stała, a większość turniejów używa dwóch z nich.
 *
 * DWIE FALE, NIE PĘTLA. Każde zapytanie to osobna podróż do bazy, a baza stoi
 * na innej maszynie niż API: zmierzone na produkcji wychodzi około 165 ms na
 * zapytanie, niezależnie od tego, ile wierszy zwraca. Sześć faz razy trzy
 * zapytania jedno po drugim to osiemnaście podróży, czyli blisko trzy sekundy
 * czekania na dane, które nic o sobie nawzajem nie wiedzą.
 *
 * Fazy są od siebie niezależne, więc lecą równolegle. Zostaje zależność
 * prawdziwa i tylko ona wymusza drugą falę: o wynik i punkty pytamy wyłącznie
 * dla faz, w których gracz cokolwiek obstawił.
 */
export async function loadTeamPicks(
  pool,
  { guildId, eventId, userId, slug },
) {
  /*
   * Turniej wskazany slugiem ALBO para identyfikatorow.
   *
   * Druga postac istnieje po to, zeby wolajacy nie musial najpierw odczytac
   * wiersza turnieju tylko po to, zeby poznac te dwie liczby - a taki odczyt
   * to pelna podroz do bazy, zmierzone na serwerze 177 ms.
   *
   * Podmiana nie zmienia LICZBY znakow zapytania: jeden warunek z dwoma
   * podstawieniami zamienia sie na dwa podzapytania, tez z dwoma. Dzieki temu
   * tablice argumentow zachowuja dlugosc i kolejnosc, a jedyna roznica jest
   * taka, ze w obu miejscach stoi slug zamiast dwoch identyfikatorow.
   */
  const poSlugu = Boolean(slug);

  const naSlug = (sql) =>
    poSlugu
      ? sql.replace(
        /guild_id = \? AND event_id = \?/g,
        // COLLATE po stronie PODZAPYTANIA, nie kolumny: events.guild_id ma
        // utf8mb4_0900_ai_ci, a tabele faz utf8mb4_unicode_ci, wiec samo
        // porownanie leci ER_CANT_AGGREGATE_2COLLATIONS. Rzutowanie strony
        // z podzapytaniem zostawia indeks na kolumnie nietkniety.
        "guild_id = CAST((SELECT guild_id FROM events WHERE slug = ? LIMIT 1)" +
            " AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci" +
            " AND event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)",
      )
      : sql;

  // Para argumentow wstawiana wszedzie tam, gdzie wczesniej szly guildId
  // i eventId - w tej samej kolejnosci.
  const para = poSlugu ? [slug, slug] : [guildId, eventId];

  const fazy = Object.entries(PHASE_KINDS).map(([phase, kind]) => {
    const swiss = kind === "swiss";

    const zrodlo = ZAPYTANIA[kind];

    return {
      phase,
      kind,
      swiss,

      q: {
        prediction: naSlug(zrodlo.prediction),
        result: naSlug(zrodlo.result),
        points: naSlug(zrodlo.points),
      },

      argsTypu: swiss ? [...para, userId, phase] : [...para, userId],
    };
  });

  // Fala 1: typy wszystkich faz naraz.
  const typy = await Promise.all(
    fazy.map((f) => pool.query(f.q.prediction, f.argsTypu)),
  );

  // Promise.all zachowuje kolejność, więc indeks nadal wskazuje tę samą fazę.
  const zTypem = fazy
    .map((f, i) => ({ ...f, prediction: typy[i][0][0] }))
    .filter((f) => f.prediction);

  // Fala 2: wynik i punkty, tylko dla faz z typem.
  const reszta = await Promise.all(
    zTypem.map((f) =>
      Promise.all([
        pool.query(f.q.result, f.swiss ? [...para, f.phase] : [...para]),
        pool.query(f.q.points, f.argsTypu),
      ]),
    ),
  );

  return zTypem
    .map((f, i) => {
      const [[[result]], [[score]]] = reszta[i];

      return {
        phase: f.phase,
        kind: f.kind,
        published: Boolean(result),
        points: score ? Number(score.points || 0) : null,
        groups: buildGroups(f.kind, f.prediction, result),
      };
    })
    .filter((faza) => faza.groups.length > 0);
}

/**
 * Adresy logotypów dla nazw, które faktycznie padły w typach.
 *
 * Mapa jest kluczowana DOKŁADNIE tym zapisem nazwy, który widok ma w danych -
 * normalizacja zostaje po stronie serwera. Inaczej front musiałby powtarzać tę
 * samą funkcję i miałby własną okazję, żeby zacząć normalizować inaczej.
 */
export async function loadTeamLogos(pool, fazy) {
  const nazwy = new Set();

  for (const faza of fazy) {
    for (const grupa of faza.groups) {
      for (const team of grupa.picked) nazwy.add(team);
    }
  }

  if (!nazwy.size) return {};

  const klucze = [...nazwy].map((n) => normalizeTeamName(n)).filter(Boolean);

  if (!klucze.length) return {};

  const [wiersze] = await pool.query(
    `SELECT name_key, logo_url FROM team_logos
       WHERE name_key IN (?) AND logo_url IS NOT NULL`,
    [klucze],
  );

  const poKluczu = new Map(wiersze.map((w) => [w.name_key, w.logo_url]));

  const wynik = {};

  for (const nazwa of nazwy) {
    const url = poKluczu.get(normalizeTeamName(nazwa));

    if (url) wynik[nazwa] = url;
  }

  return wynik;
}
