// Gdzie społeczność myli się o konkretnej drużynie.
//
// Strona drużyny podaje dziś dwie liczby obok siebie - „zaufanie" (jak
// chętnie się na nią stawia) i „wygrywa" (jak często rzeczywiście wygrywa) -
// i nikt ich od siebie nie odejmuje. A to odejmowanie jest całą treścią:
//
//   GamerLegion   tłum stawiał 85%, wygrała 40%   -> +45
//   NRG           tłum stawiał 14%, wygrała 44%   -> -30
//
// NIC NIE LICZY OD NOWA i nie robi żadnego zapytania. `trust` i `win_rate`
// przychodzą gotowe z /api/public/teams, na którym stoi lista drużyn.
//
// PRÓG JEST ZMIERZONY, NIE ZGADNIĘTY. Przy pięciu meczach `win_rate` skacze
// co dwadzieścia punktów, więc różnica +31 potrafi być samym szumem.
// Mediana |różnicy| na produkcji, według liczby rozstrzygniętych meczów:
//
//   1-4 meczów    7 drużyn    mediana 18   maksimum 65
//   5-7           6           mediana 30   maksimum 51
//   8-11         17           mediana 12   maksimum 45
//   12+           7           mediana  9   maksimum 29
//
// Mediana spada z trzydziestu do dwunastu dokładnie na ósmym meczu - to jest
// szum, który znika, a nie wiedza, która się pojawia. Stąd MIN_ROZSTRZYGNIETYCH.
//
// DRUGI PRÓG jest po to, żeby nie nazywać „przecenianą" drużyny, która stoi
// w medianie. Przy ośmiu meczach typowa różnica to dwanaście punktów, więc
// piętnaście jest pierwszą wartością wyraźnie ponad tłem.
//
// To jest ta sama pułapka, w którą wpadliśmy raz przy odznace najlepszego
// rywala: 8-2 (80%) wyglądało lepiej niż 46-27 (63%), bo mała próba potrafi
// pokazać każdą liczbę.

/** Poniżej tylu rozstrzygniętych meczów różnica jest szumem. */
export const MIN_ROZSTRZYGNIETYCH = 8;

/** Poniżej tylu punktów różnicy drużyna stoi w medianie i nic nie mówi. */
export const MIN_ROZNICA = 15;

/** Ile drużyn pokazać z każdej strony. */
export const ILE_NA_STRONE = 5;

function liczbaAlbo(wartosc) {
  if (wartosc === null || wartosc === undefined || wartosc === "") return null;

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : null;
}

/**
 * Drużyny, o których społeczność myli się najbardziej.
 *
 * @param teams wiersze z /api/public/teams: settled, trust, win_rate,
 *              picks_total, name, key, logo
 * @returns {{ overrated: Array, underrated: Array, considered: number }}
 */
export function buildCrowdBias(teams, opcje = {}) {
  const minMeczow = opcje.minSettled ?? MIN_ROZSTRZYGNIETYCH;
  const minRoznica = opcje.minGap ?? MIN_ROZNICA;
  const ile = opcje.limit ?? ILE_NA_STRONE;

  const brane = [];

  for (const t of teams || []) {
    const settled = liczbaAlbo(t?.settled);
    const trust = liczbaAlbo(t?.trust);
    const winRate = liczbaAlbo(t?.win_rate);

    // null, a nie zero: „nikt na nią nie stawiał" i „stawiali i przegrała"
    // to dwie różne rzeczy, a tylko o drugiej da się cokolwiek powiedzieć.
    if (settled === null || trust === null || winRate === null) continue;

    if (settled < minMeczow) continue;

    const gap = trust - winRate;

    if (Math.abs(gap) < minRoznica) continue;

    brane.push({
      key: t.key,
      name: t.name,
      logo: t.logo ?? null,
      settled,
      trust,
      win_rate: winRate,
      picks_total: liczbaAlbo(t?.picks_total) ?? 0,
      gap,
    });
  }

  // Przy równej różnicy wyżej stoi ta z większą liczbą meczów - jej liczba
  // jest pewniejsza. Klucz na końcu, żeby wynik nie zależał od kolejności
  // wierszy z bazy.
  const wedlug = (kierunek) => (a, b) =>
    kierunek * (b.gap - a.gap) ||
    b.settled - a.settled ||
    String(a.key).localeCompare(String(b.key));

  return {
    overrated: brane.filter((t) => t.gap > 0).sort(wedlug(1)).slice(0, ile),
    underrated: brane.filter((t) => t.gap < 0).sort(wedlug(-1)).slice(0, ile),

    // Ile drużyn w ogóle przeszło próg meczów - do zdania pod nagłówkiem.
    considered: (teams || []).filter(
      (t) => (liczbaAlbo(t?.settled) ?? 0) >= minMeczow,
    ).length,
  };
}
