// Punkty fazowe na profilu gracza (server/lib/phasePoints.js).
//
// Zmierzone na produkcji: 708 z 1294 wpisow gracz-turniej nie ma ani jednego
// wiersza w match_points. Pierwsze miejsce w StarLadder Budapest 2025 -
// Lemonziiko, 47 punktow - zbieralo je tak: stage1 +12, stage2 +16,
// stage3 +12, playoffs +7. Profil pokazywal mu siedem kafelkow z zerem
// i pusty wykres.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/phasePoints.js";

test("sumuje fazy i zwraca przebieg narastajaco", async () => {
  const { buildPhasePoints } = await import(MODUL);

  const { total, groups, progress } = buildPhasePoints([
    { phase: "swiss", stage: "stage1", points: 12 },
    { phase: "swiss", stage: "stage2", points: 16 },
    { phase: "swiss", stage: "stage3", points: 12 },
    { phase: "playoffs", stage: null, points: 7 },
  ]);

  assert.equal(total, 47, "tyle ma pierwsze miejsce Budapesztu");

  assert.deepEqual(groups, [
    { phase: "swiss", points: 40 },
    { phase: "playoffs", points: 7 },
  ]);

  assert.deepEqual(
    progress.map((p) => p.total),
    [12, 28, 40, 47],
  );
});

test("kolejnosc idzie za przebiegiem turnieju, nie za kolejnoscia wierszy", async () => {
  // To jest os X wykresu. Baza nie gwarantuje zadnej kolejnosci, a zle
  // ulozony przebieg wyglada poprawnie i nikt go nie zglosi.
  const { buildPhasePoints, PHASE_ORDER } = await import(MODUL);

  const { groups, progress } = buildPhasePoints([
    { phase: "mvp", stage: null, points: 1 },
    { phase: "playoffs", stage: null, points: 7 },
    { phase: "swiss", stage: "stage2", points: 16 },
    { phase: "swiss", stage: "stage1", points: 12 },
    { phase: "playin", stage: null, points: 5 },
    { phase: "doubleelim", stage: null, points: 3 },
  ]);

  assert.deepEqual(
    groups.map((g) => g.phase),
    PHASE_ORDER,
    "kazda faza raz, w kolejnosci turnieju",
  );

  assert.deepEqual(
    progress.map((p) => p.stage ?? p.phase),
    ["playin", "stage1", "stage2", "doubleelim", "playoffs", "mvp"],
  );
});

test("faza z zerem NIE dostaje kafelka, ale zostaje w przebiegu", async () => {
  // mvp_scores ma 99 wierszy i 15 punktow lacznie - kafelek "MVP 0"
  // wyskoczylby prawie kazdemu i nie mowilby nic. Na wykresie ten sam
  // zerowy etap jest plaskim odcinkiem, czyli przestojem, i to jest
  // informacja.
  const { buildPhasePoints } = await import(MODUL);

  const { groups, progress } = buildPhasePoints([
    { phase: "swiss", stage: "stage1", points: 12 },
    { phase: "swiss", stage: "stage2", points: 0 },
    { phase: "mvp", stage: null, points: 0 },
  ]);

  assert.deepEqual(groups, [{ phase: "swiss", points: 12 }]);

  assert.equal(progress.length, 3, "wszystkie trzy wiersze sa w przebiegu");

  assert.deepEqual(
    progress.map((p) => p.total),
    [12, 12, 12],
  );
});

test("nieznana faza jest pomijana, a nie doliczana po cichu", async () => {
  // Nowa tabela punktow bez wpisu w PHASE_ORDER nie ma gdzie stanac na osi
  // czasu. Lepiej, zeby jej nie bylo, niz zeby wyladowala w losowym miejscu.
  const { buildPhasePoints } = await import(MODUL);

  const { total, groups } = buildPhasePoints([
    { phase: "swiss", stage: "stage1", points: 12 },
    { phase: "pucharTrenera", stage: null, points: 99 },
  ]);

  assert.equal(total, 12);
  assert.deepEqual(groups, [{ phase: "swiss", points: 12 }]);
});

test("NULL i smiec w punktach licza sie jako zero", async () => {
  const { buildPhasePoints } = await import(MODUL);

  const { total } = buildPhasePoints([
    { phase: "swiss", stage: "stage1", points: null },
    { phase: "swiss", stage: "stage2", points: "8" },
    { phase: "playoffs", stage: null, points: "brak" },
  ]);

  assert.equal(total, 8);
});

test("brak wierszy daje zera, a nie wyjatek", async () => {
  const { buildPhasePoints } = await import(MODUL);

  for (const wejscie of [[], null, undefined]) {
    const w = buildPhasePoints(wejscie);

    assert.equal(w.total, 0);
    assert.deepEqual(w.groups, []);
    assert.deepEqual(w.progress, []);
  }
});

test("przebieg niesie etap i faze, zeby wykres mial co podpisac", async () => {
  const { buildPhasePoints } = await import(MODUL);

  const { progress } = buildPhasePoints([
    { phase: "swiss", stage: "stage1", points: 12 },
    { phase: "playoffs", stage: null, points: 7 },
  ]);

  assert.deepEqual(progress[0], {
    n: 1,
    phase: "swiss",
    stage: "stage1",
    points: 12,
    total: 12,
  });

  assert.equal(progress[1].stage, null, "faza bez etapow nie zmysla nazwy");
});
