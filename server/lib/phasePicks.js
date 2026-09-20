// Typy gracza NA FAZY, zebrane w jedną listę - drugą połowę audytu.
//
// CZEGO BRAKOWAŁO. Audyt gracza (server/lib/userAudit.js) pokazuje komplet
// typów MECZOWYCH i nic poza tym. Tymczasem klasyfikacja turnieju to suma
// sześciu składowych, a pięć z nich to fazy: kto pójdzie 3-0, kto odpadnie
// 0-3, kto awansuje, kto zagra w finałach drabinki, kto weźmie MVP.
//
// Zmierzone na produkcji - ilu graczy widziało w audycie PUSTKĘ, bo typowali
// wyłącznie fazy:
//
//   StarLadder Budapest Major 2025    509 z 509   (zero meczów w bazie)
//   IEM Cologne Major 2026            114 z 523
//   IEM Kraków 2026                    11 z 262
//
// Razem 634 wpisy gracz-turniej, przy których pytanie „co on właściwie
// wytypował" nie miało na stronie żadnej odpowiedzi.
//
// TRAFIENIE LICZONE DOKŁADNIE TAK, JAK LICZY JE BOT: porównaniem nazw
// znak w znak (handlers/matches/calculateScores.js robi
// `correct.includes(nazwa)` na zwykłych napisach). Kuszące było zestawianie
// przez teamKey, żeby „Parivision" spotkało się z „PARIVISION" - ale wtedy
// audyt pokazywałby trafienie tam, gdzie bot punktu nie dał, czyli kłamałby
// akurat w tej jednej rzeczy, po którą się go otwiera. Przeliczone na
// wszystkich 19 183 typach fazowych z rozstrzygniętą grupą: przypadków,
// w których typ przepada WYŁĄCZNIE przez inną pisownię, jest ZERO - więc
// ostrzejsza reguła nic nikogo nie kosztuje.
//
// Możliwe są, i to nie teoretycznie: oficjalna odpowiedź na awans w trzecim
// etapie Budapesztu ma „Faze Clan", a ta sama drużyna stoi w innych polach
// jako „FaZe Clan". Nikt po prostu nie trafił akurat w ten wariant.
//
// NIE PRZELICZAMY PUNKTÓW - ta sama zasada, co w userAudit.js. Punkty faz
// przychodzą z tabel *_scores, czyli stamtąd, skąd bierze je klasyfikacja.
// Że to nie jest teoretyczne: w playoffach Kolonii 31 z 99 graczy ma
// zapisane o 2 punkty więcej, niż dałaby dzisiejsza reguła - to ślad po
// błędzie z trzecim miejscem (NULL === NULL), opisanym w calculateScores.
// Moduł, który liczyłby po swojemu, pokazywałby tym graczom inną liczbę niż
// tabela obok i nie dałoby się powiedzieć, która kłamie.
//
// CZYSTY, BEZ IMPORTÓW POZA KOLEJNOŚCIĄ FAZ - regułę da się sprawdzić bez bazy.

import { PHASE_ORDER } from "./phasePoints.js";

/**
 * Grupy typów w każdej fazie, w kolejności wypełniania formularza.
 *
 * Ta tablica jest jedynym miejscem, które wie, z czego składa się faza -
 * zapytanie w trasie i podpisy na stronie idą za nią, a nie obok niej.
 */
export const PHASE_GROUPS = {
  playin: ["teams"],
  swiss: ["three_zero", "zero_three", "advancing"],
  doubleelim: [
    "upper_final_a",
    "lower_final_a",
    "upper_final_b",
    "lower_final_b",
  ],
  playoffs: ["semifinalists", "finalists", "winner", "third_place"],
  mvp: ["mvp"],
};

/**
 * Lista drużyn z pola tekstowego.
 *
 * Kopia `cleanList` z handlers/matches/calculateScores.js co do znaku -
 * łącznie z próbą JSON-a na wejściu, bo część wierszy w bazie to tablice
 * zapisane jako tekst. Gdyby ten podział różnił się od tamtego choćby
 * o przecinek, audyt liczyłby inne typy, niż bot punktował.
 */
export function splitTeams(wartosc) {
  if (!wartosc) return [];

  try {
    const sparsowane = JSON.parse(wartosc);

    if (Array.isArray(sparsowane)) return sparsowane.map(String);
  } catch {
    // zwykły CSV
  }

  return String(wartosc)
    .replace(/[[\]"]+/g, "")
    .split(/[;,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function liczba(wartosc) {
  const n = Number(wartosc);

  return Number.isFinite(n) ? n : 0;
}

/** Klucz sekcji. Etap ma wyłącznie Swiss - reszta faz to jeden wiersz. */
function kluczSekcji(phase, stage) {
  return stage ? `${phase}:${stage}` : phase;
}

/**
 * Typy fazowe jednego gracza w jednym turnieju.
 *
 * @param picks   wiersze { phase, stage, kind, teams } - typy gracza
 * @param results wiersze { phase, stage, kind, teams } - oficjalne wyniki
 * @param scores  wiersze { phase, stage, points } z tabel *_scores
 * @returns {{ phases: Array, summary: object }}
 */
export function buildPhasePicks({ picks = [], results = [], scores = [] } = {}) {
  const sekcje = new Map();

  function sekcja(phase, stage) {
    if (!PHASE_GROUPS[phase]) return null;

    const klucz = kluczSekcji(phase, stage ?? null);

    let s = sekcje.get(klucz);

    if (!s) {
      s = {
        key: klucz,
        phase,
        stage: stage ?? null,
        typy: new Map(),
        odpowiedzi: new Map(),
        points: null,
      };

      sekcje.set(klucz, s);
    }

    return s;
  }

  for (const p of picks || []) {
    const s = sekcja(p?.phase, p?.stage);

    if (s) s.typy.set(p.kind, splitTeams(p.teams));
  }

  // Wynik fazy tworzy sekcję TAK SAMO jak typ. Faza, w której gracz nie
  // wpisał nic, jest odpowiedzią na najczęstsze pytanie audytu („czy on to
  // w ogóle obstawił") i przemilczenie jej odpowiadałoby na nie ciszą -
  // dokładnie ten sam zabieg, co mecz bez typu w userAudit.js.
  for (const r of results || []) {
    const s = sekcja(r?.phase, r?.stage);

    if (s) s.odpowiedzi.set(r.kind, splitTeams(r.teams));
  }

  for (const w of scores || []) {
    const s = sekcja(w?.phase, w?.stage);

    if (s) s.points = (s.points ?? 0) + liczba(w?.points);
  }

  const uporzadkowane = [...sekcje.values()].sort(
    (a, b) =>
      PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) ||
      String(a.stage ?? "").localeCompare(String(b.stage ?? "")),
  );

  const phases = uporzadkowane.map((s) => {
    const groups = PHASE_GROUPS[s.phase]
      .filter((kind) => s.typy.has(kind) || s.odpowiedzi.has(kind))
      .map((kind) => {
        const odpowiedz = s.odpowiedzi.get(kind) ?? [];

        // Rozstrzygnięta jest GRUPA, nie cała faza. W Kolonii playoffs mają
        // wynik, ale pole „3. miejsce" jest w nim puste - typ na ten jeden
        // mecz nie jest wtedy pudłem, tylko pytaniem bez odpowiedzi.
        const rozstrzygnieta = odpowiedz.length > 0;

        const zbior = new Set(odpowiedz);

        return {
          kind,
          answer: odpowiedz,

          picked: (s.typy.get(kind) ?? []).map((name) => ({
            name,
            hit: rozstrzygnieta ? zbior.has(name) : null,
          })),
        };
      });

    // Grupa pusta z obu stron nie mówi nic i zajmuje wiersz. Bierze się
    // z wyniku fazy z niewypełnionym polem: w Budapeszcie playoffs mają
    // wynik, ale bez meczu o 3. miejsce, więc wiersz brzmiałby
    // „3. miejsce: — / —".
    const widoczne = groups.filter(
      (g) => g.picked.length > 0 || g.answer.length > 0,
    );

    const wszystkie = widoczne.flatMap((g) => g.picked);

    return {
      key: s.key,
      phase: s.phase,
      stage: s.stage,

      points: s.points,

      picked: wszystkie.length > 0,
      settled: widoczne.some((g) => g.answer.length > 0),

      picks: wszystkie.length,
      settled_picks: wszystkie.filter((p) => p.hit !== null).length,
      hits: wszystkie.filter((p) => p.hit === true).length,

      groups: widoczne,
    };
  });

  return {
    phases,

    summary: {
      phases: phases.length,

      // null, a nie zero: „żadna faza nie ma policzonych punktów" i „fazy dały
      // zero punktów" to dwie różne rzeczy, a zero mówiłoby to drugie.
      points: phases.some((f) => f.points !== null)
        ? phases.reduce((suma, f) => suma + (f.points ?? 0), 0)
        : null,

      picks: phases.reduce((suma, f) => suma + f.picks, 0),
      settled_picks: phases.reduce((suma, f) => suma + f.settled_picks, 0),
      hits: phases.reduce((suma, f) => suma + f.hits, 0),
    },
  };
}
