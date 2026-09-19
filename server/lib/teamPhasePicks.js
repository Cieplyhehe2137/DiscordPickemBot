// Typy fazowe zsumowane NA POZIOMIE DRUŻYNY.
//
// server/lib/teamStats.js mówi wprost, że liczy WYŁĄCZNIE mecze, bo typy na
// awans leżą jako listy tekstowe i są „osobną robotą". Widok tej roboty per
// turniej zrobiła strona typów na fazy; to jest jej druga połowa - ta sama
// wiedza zebrana wokół drużyny.
//
// CO TO ZMIENIA. Strona drużyn stoi na meczach, więc siedem zespołów, które
// zagrały wyłącznie w StarLadder Budapest 2025 (zero meczów w bazie), nie
// istniało na niej wcale - mimo setek ocen. Zmierzone: drużyn w typach
// fazowych jest 45, a poza listą meczową osiem.
//
// I JEST O CZYM PISAĆ. Zmierzone na produkcji:
//
//   GamerLegion   484 typy na awans, trafnie 11%   - najbardziej przeceniana
//   PARIVISION    347 typów,         trafnie 87%   - najpewniejsza
//   Imperial      285 razy skazana na 0-3, trafnie 0%
//                  ...a na awans 76 razy, trafnie 95%
//
// CZYSTY I BEZ IMPORTÓW POZA teamKey - regułę da się sprawdzić bez bazy.

import { teamKey } from "./teamLogos.js";

/** Trzy rzeczy, które typuje się o drużynie w fazie Swiss. */
const GRUPY = [
  { pole: "advancing", poprawne: "correct_advancing", nazwa: "advance" },
  { pole: "pick_3_0", poprawne: "correct_3_0", nazwa: "three_zero" },
  { pole: "pick_0_3", poprawne: "correct_0_3", nazwa: "zero_three" },
];

function lista(wartosc) {
  if (!wartosc) return [];

  return String(wartosc)
    .replace(/[[\]"]+/g, "")
    .split(/[;,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function procent(ile, z) {
  return z > 0 ? Math.round((100 * ile) / z) : null;
}

/**
 * Typy fazowe zebrane wokół drużyn.
 *
 * @param predictions wiersze swiss_predictions: stage, event_id, pick_3_0,
 *                    pick_0_3, advancing
 * @param results     wiersze swiss_results: stage, event_id, correct_3_0,
 *                    correct_0_3, correct_advancing
 * @param logos       [{ name_key, logo_url }]
 * @returns Map klucz drużyny -> podsumowanie
 */
export function buildTeamPhasePicks(predictions, results, { logos = [] } = {}) {
  const logotypy = new Map();

  for (const l of logos || []) {
    if (l?.name_key && l?.logo_url) logotypy.set(l.name_key, l.logo_url);
  }

  // Poprawne odpowiedzi po (turniej, etap) - typ bez rozstrzygniętego etapu
  // liczy się do liczby typów, ale nie może podnosić ani obniżać trafności.
  const poprawne = new Map();

  for (const r of results || []) {
    poprawne.set(`${r?.event_id}:${r?.stage}`, r);
  }

  const druzyny = new Map();

  function wpis(nazwa) {
    const k = teamKey(nazwa);

    if (!k) return null;

    let d = druzyny.get(k);

    if (!d) {
      d = {
        key: k,
        zapisy: new Map(),
        advance: { picks: 0, right: 0, settled: 0 },
        three_zero: { picks: 0, right: 0, settled: 0 },
        zero_three: { picks: 0, right: 0, settled: 0 },
      };

      druzyny.set(k, d);
    }

    d.zapisy.set(nazwa, (d.zapisy.get(nazwa) ?? 0) + 1);

    return d;
  }

  for (const p of predictions || []) {
    const wynik = poprawne.get(`${p?.event_id}:${p?.stage}`) ?? null;

    for (const g of GRUPY) {
      const kluczePoprawnych = new Set(
        wynik ? lista(wynik[g.poprawne]).map((n) => teamKey(n)) : [],
      );

      // Ten sam gracz mógł wpisać drużynę dwa razy w jednym polu - to jedno
      // jego zdanie o niej, nie dwa.
      const juz = new Set();

      for (const nazwa of lista(p[g.pole])) {
        const d = wpis(nazwa);

        if (!d) continue;

        if (juz.has(`${g.nazwa}:${d.key}`)) continue;

        juz.add(`${g.nazwa}:${d.key}`);

        const licznik = d[g.nazwa];

        licznik.picks += 1;

        // Trafność liczona tylko z etapów, które mają wynik.
        if (wynik) {
          licznik.settled += 1;

          if (kluczePoprawnych.has(d.key)) licznik.right += 1;
        }
      }
    }
  }

  const gotowe = new Map();

  for (const d of druzyny.values()) {
    // Nazwa większościowa, nie najdłuższa: „Furia" i „FURIA" mają tyle samo
    // znaków, więc długość ich nie rozstrzyga, a kolejność wierszy z bazy
    // nie jest niczym ustalona.
    const nazwa = [...d.zapisy.entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
    )[0][0];

    const grupa = (g) => ({
      picks: g.picks,
      settled: g.settled,
      right: g.right,

      // null, a nie zero: „nikt nie typował" i „typowali i się mylili" to
      // dwie różne rzeczy, a zero mówiłoby to drugie.
      hit: procent(g.right, g.settled),
    });

    gotowe.set(d.key, {
      key: d.key,
      name: nazwa,
      logo: logotypy.get(d.key) ?? null,

      advance: grupa(d.advance),
      three_zero: grupa(d.three_zero),
      zero_three: grupa(d.zero_three),

      // Ile razy w ogóle ktoś o tej drużynie coś orzekł. Po tym sortuje się
      // lista drużyn bez meczów - inaczej nie ma czym.
      total: d.advance.picks + d.three_zero.picks + d.zero_three.picks,
    });
  }

  return gotowe;
}
