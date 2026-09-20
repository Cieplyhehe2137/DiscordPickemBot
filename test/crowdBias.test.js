// Przeceniane i niedoceniane druzyny (web/src/lib/crowdBias.js).
//
// Zmierzone na produkcji: GamerLegion - tlum stawial 85%, wygrala 40%,
// dziesiec rozstrzygnietych meczow i 1078 typow. NRG odwrotnie: stawialo
// na nia 14%, wygrala 44%.
//
// Cala trudnosc jest w progach. Mediana |roznicy| wedlug liczby meczow:
// 5-7 meczow -> 30, 8-11 -> 12, 12+ -> 9. Ponizej osmiu meczu roznica jest
// szumem, a nie wiedza.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../web/src/lib/crowdBias.js";

function druzyna({ key = "t", name = "T", settled = 10, trust = 50, win_rate = 50, picks_total = 500 } = {}) {
  return { key, name, settled, trust, win_rate, picks_total, logo: null };
}

test("dzieli druzyny na przeceniane i niedoceniane", async () => {
  const { buildCrowdBias } = await import(MODUL);

  const { overrated, underrated } = buildCrowdBias([
    druzyna({ key: "gamerlegion", name: "GamerLegion", settled: 10, trust: 85, win_rate: 40 }),
    druzyna({ key: "nrg", name: "NRG", settled: 9, trust: 14, win_rate: 44 }),
  ]);

  assert.deepEqual(overrated.map((t) => t.key), ["gamerlegion"]);
  assert.equal(overrated[0].gap, 45);

  assert.deepEqual(underrated.map((t) => t.key), ["nrg"]);
  assert.equal(underrated[0].gap, -30);
});

test("mala proba NIE trafia na liste, choc ma najwieksza roznice", async () => {
  // To jest cel tego modulu. Na produkcji SINNERS mial +65 na TRZECH
  // meczach - najwieksza roznica w calej bazie i zarazem czysty szum.
  const { buildCrowdBias } = await import(MODUL);

  const { overrated } = buildCrowdBias([
    druzyna({ key: "sinners", name: "SINNERS", settled: 3, trust: 68, win_rate: 3 }),
    druzyna({ key: "legacy", name: "Legacy", settled: 11, trust: 63, win_rate: 36 }),
  ]);

  assert.deepEqual(
    overrated.map((t) => t.key),
    ["legacy"],
    "trzy mecze to za malo, nawet przy +65",
  );
});

test("druzyna w medianie nie jest ani przeceniana, ani niedoceniana", async () => {
  // Przy osmiu meczach typowa roznica to dwanascie punktow. Nazwanie
  // kogos przecenianym za bycie przecietnym odbieraloby slowu znaczenie.
  const { buildCrowdBias } = await import(MODUL);

  const { overrated, underrated } = buildCrowdBias([
    druzyna({ key: "mibr", settled: 8, trust: 51, win_rate: 50 }),
    druzyna({ key: "b8", settled: 13, trust: 58, win_rate: 46 }),
  ]);

  assert.deepEqual(overrated, []);
  assert.deepEqual(underrated, []);
});

test("brak danych to pominiecie, a nie zero", async () => {
  // "Nikt na nia nie stawial" i "stawiali i przegrala" to dwie rozne
  // rzeczy. Zero w miejscu null zrobiloby z pierwszej najbardziej
  // niedocenianej druzyny w historii.
  const { buildCrowdBias } = await import(MODUL);

  const { overrated, underrated, considered } = buildCrowdBias([
    druzyna({ key: "bez-typow", settled: 12, trust: null, win_rate: 60 }),
    druzyna({ key: "bez-wynikow", settled: 12, trust: 40, win_rate: null }),
    { key: "smiec", name: "?", settled: "dziesiec", trust: 90, win_rate: 10 },
  ]);

  assert.deepEqual(overrated, []);
  assert.deepEqual(underrated, []);
  assert.equal(considered, 2, "dwie przeszly prog meczow, choc nic nie mowia");
});

test("kolejnosc nie zalezy od kolejnosci wierszy z bazy", async () => {
  const { buildCrowdBias } = await import(MODUL);

  const wiersze = [
    druzyna({ key: "a", settled: 10, trust: 80, win_rate: 40 }),
    druzyna({ key: "b", settled: 20, trust: 70, win_rate: 30 }),
    druzyna({ key: "c", settled: 9, trust: 60, win_rate: 20 }),
  ];

  const kolejnosc = (l) => buildCrowdBias(l).overrated.map((t) => t.key);

  // Wszystkie maja roznice +40, wiec rozstrzyga liczba meczow.
  assert.deepEqual(kolejnosc(wiersze), ["b", "a", "c"]);
  assert.deepEqual(kolejnosc([...wiersze].reverse()), ["b", "a", "c"]);
});

test("progi da sie podniesc, a domyslne sa te zmierzone", async () => {
  const { buildCrowdBias, MIN_ROZSTRZYGNIETYCH, MIN_ROZNICA } = await import(MODUL);

  assert.equal(MIN_ROZSTRZYGNIETYCH, 8);
  assert.equal(MIN_ROZNICA, 15);

  const lista = [druzyna({ key: "x", settled: 9, trust: 60, win_rate: 40 })];

  assert.equal(buildCrowdBias(lista).overrated.length, 1);
  assert.equal(buildCrowdBias(lista, { minSettled: 10 }).overrated.length, 0);
  assert.equal(buildCrowdBias(lista, { minGap: 25 }).overrated.length, 0);
});

test("lista jest ucinana, zeby sekcja nie zjadla strony", async () => {
  const { buildCrowdBias, ILE_NA_STRONE } = await import(MODUL);

  const duzo = Array.from({ length: 12 }, (_, i) =>
    druzyna({ key: `t${i}`, settled: 10, trust: 90, win_rate: 90 - 20 - i }),
  );

  assert.equal(buildCrowdBias(duzo).overrated.length, ILE_NA_STRONE);
  assert.equal(buildCrowdBias(duzo, { limit: 2 }).overrated.length, 2);
});

test("pusta lista i smiec nie wywracaja liczenia", async () => {
  const { buildCrowdBias } = await import(MODUL);

  for (const wejscie of [[], null, undefined]) {
    const w = buildCrowdBias(wejscie);

    assert.deepEqual(w.overrated, []);
    assert.deepEqual(w.underrated, []);
    assert.equal(w.considered, 0);
  }
});
