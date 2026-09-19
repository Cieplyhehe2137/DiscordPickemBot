// Typy na fazy Swiss zestawione z tym, co naprawdę się stało.
//
// Do tej pory statystyki drużyn na tej stronie liczyły WYŁĄCZNIE mecze -
// server/lib/teamStats.js mówi to wprost: „Typy na awans z faz leżą w bazie
// jako listy tekstowe i policzenie ich wymagałoby rozbioru każdego wiersza
// każdego gracza - to osobna robota, nie skutek uboczny tej."
//
// Ta osobna robota jest tutaj. Materiału jest więcej niż w meczach: 2 074
// wiersze faz od 742 graczy dają po rozbiciu 18 803 oceny drużyn, wobec
// 10 328 typów meczowych od 638 graczy.
//
// I jest turniej, który bez tego nie istnieje. StarLadder Budapest 2025 ma
// ZERO rozegranych meczów w bazie, więc nie pojawia się w żadnej statystyce
// drużyn - a ma 837 typów fazowych. Fnatic, Imperial, RED Canids, Lynn
// Vision Gaming, The Huns Esports, Rare Atom i Fluxo grały tylko tam,
// więc dziś nie ma ich na stronie wcale.
//
// DWIE HISTORIE, KTÓRE TU WIDAĆ. Zmierzone na produkcji:
//
//   PEWNIAKI, KTÓRE NIE WYSZŁY
//     GamerLegion       84% na 3-0    nie poszła
//     Vitality          80% na 3-0    nie poszła
//     THUNDER dOWNUNDER 76% na 0-3    nie poszła
//     B8                71% na awans  nie awansowała
//
//   POPRAWNE ODPOWIEDZI, KTÓRYCH NIKT NIE WIDZIAŁ
//     Lynn Vision Gaming 1% na 0-3    poszła
//     FlyQuest           1% na 3-0    poszła
//     SINNERS            2% na 0-3    poszła
//     M80                3% na 3-0    poszła
//
// CZYSTY, bez importu bazy - reguła daje się sprawdzić testem bez niej.

import { teamKey } from "./teamLogos.js";

/** Ile drużyn pokazać w każdej grupie, zanim dojdą pominięte trafienia. */
const ILE_POKAZAC = 5;

/**
 * Poniżej ilu procent poprawna odpowiedź liczy się jako PRZEOCZONA.
 *
 * Trzydzieści, bo tyle mniej więcej dzieli „część ludzi to widziała" od
 * „prawie nikt". Zmierzone przypadki po drugiej stronie tej granicy to
 * 1%, 2%, 3% i 4% - a po pierwszej 22% i 30%, czyli co piąty typujący.
 */
const PROG_PRZEOCZENIA = 30;

/** Trzy rzeczy, które typuje się w fazie Swiss. */
const GRUPY = [
  { kind: "three_zero", pole: "pick_3_0", poprawne: "correct_3_0" },
  { kind: "zero_three", pole: "pick_0_3", poprawne: "correct_0_3" },
  { kind: "advancing", pole: "advancing", poprawne: "correct_advancing" },
];

/** Lista drużyn z pola tekstowego: "B8, BetBoom". */
function lista(wartosc) {
  if (!wartosc) return [];

  return String(wartosc)
    .replace(/[[\]"]+/g, "")
    .split(/[;,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function procent(ile, z) {
  return z > 0 ? Math.round((100 * ile) / z) : 0;
}

/**
 * Podział głosów w jednej grupie, zestawiony z poprawną odpowiedzią.
 */
function zlicz(typy, pole, poprawneNazwy, logotypy, { topTeams, missedBelow }) {
  const kluczePoprawnych = new Set(poprawneNazwy.map((n) => teamKey(n)));

  // Zapisy grupowane po kluczu, bo w bazie stoi wolny tekst: „FaZe Clan"
  // obok „Faze Clan", „PARIVISION" obok „Parivision". Liczone osobno dałyby
  // dwie mniejsze drużyny zamiast jednej.
  const wpisy = new Map();

  for (const t of typy) {
    // Ten sam gracz mógł wpisać drużynę dwa razy w jednym polu; liczy się
    // raz, bo to jest JEGO zdanie o niej, a nie dwa zdania.
    const juz = new Set();

    for (const nazwa of lista(t[pole])) {
      const k = teamKey(nazwa);

      if (!k || juz.has(k)) continue;

      juz.add(k);

      let w = wpisy.get(k);

      if (!w) {
        w = { key: k, count: 0, zapisy: new Map() };
        wpisy.set(k, w);
      }

      w.count += 1;
      w.zapisy.set(nazwa, (w.zapisy.get(nazwa) ?? 0) + 1);
    }
  }

  const razem = typy.length;

  const nazwaWiekszosci = (w) =>
    [...w.zapisy.entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
    )[0][0];

  const druzyny = [...wpisy.values()]
    .map((w) => {
      const name = nazwaWiekszosci(w);

      return {
        name,
        logo: logotypy.get(w.key) ?? null,
        count: w.count,
        percent: procent(w.count, razem),
        correct: kluczePoprawnych.has(w.key),
      };
    })
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));

  // Poprawne odpowiedzi, na które prawie nikt nie postawił. Osobno, bo to
  // jest druga połowa tej historii: tłum nie tylko stawia na złe drużyny,
  // ale i nie widzi tych właściwych.
  const przeoczone = druzyny.filter(
    (d) => d.correct && d.percent < missedBelow,
  );

  // Pokazujemy czołówkę PLUS każdą poprawną odpowiedź, nawet gdy wypadła
  // poza nią - inaczej znikałoby dokładnie to, o czym ta sekcja opowiada.
  // Ta sama reguła, co przy zwycięzcy głosowania na MVP.
  const pokazani = new Set(druzyny.slice(0, topTeams).map((d) => d.name));

  for (const d of druzyny) {
    if (d.correct) pokazani.add(d.name);
  }

  return {
    correct_count: poprawneNazwy.length,

    // Ilu poprawnych odpowiedzi tłum w ogóle nie zauważył.
    missed: przeoczone.length,

    // Najmocniej obstawiona drużyna, która NIE była poprawną odpowiedzią.
    // Zmierzone: GamerLegion 84% na 3-0, THUNDER dOWNUNDER 76% na 0-3.
    overrated: druzyny.find((d) => !d.correct) ?? null,

    teams: druzyny.filter((d) => pokazani.has(d.name)),
  };
}

/**
 * Składa podział typów fazy Swiss dla całego turnieju.
 *
 * @param predictions wiersze swiss_predictions: stage, pick_3_0, pick_0_3,
 *                    advancing
 * @param results     wiersze swiss_results: stage, correct_3_0, correct_0_3,
 *                    correct_advancing
 * @param logos       [{ name_key, logo_url }]
 */
export function buildSwissPicks(
  predictions,
  results,
  { logos = [], topTeams = ILE_POKAZAC, missedBelow = PROG_PRZEOCZENIA } = {},
) {
  const logotypy = new Map();

  for (const l of logos || []) {
    if (l?.name_key && l?.logo_url) logotypy.set(l.name_key, l.logo_url);
  }

  // Typy pogrupowane po etapie. Etap bez wyniku i tak wejdzie na listę:
  // sam podział głosów jest wart pokazania, nawet zanim etap się rozstrzygnie.
  const poEtapie = new Map();

  for (const p of predictions || []) {
    const etap = String(p?.stage ?? "");

    if (!etap) continue;

    if (!poEtapie.has(etap)) poEtapie.set(etap, []);

    poEtapie.get(etap).push(p);
  }

  const wyniki = new Map();

  for (const r of results || []) {
    if (r?.stage) wyniki.set(String(r.stage), r);
  }

  const etapy = [...poEtapie.keys()].sort();

  return {
    // Ilu graczy oddało choć jeden typ fazowy w tym turnieju. Nie suma po
    // etapach: ten sam gracz typuje zwykle wszystkie trzy.
    stages: etapy.map((etap) => {
      const typy = poEtapie.get(etap);
      const wynik = wyniki.get(etap) ?? null;

      return {
        stage: etap,
        total: typy.length,
        settled: Boolean(wynik),

        groups: GRUPY.map((g) => ({
          kind: g.kind,

          ...zlicz(typy, g.pole, wynik ? lista(wynik[g.poprawne]) : [], logotypy, {
            topTeams,
            missedBelow,
          }),
        })),
      };
    }),

    missed_below: missedBelow,
  };
}
