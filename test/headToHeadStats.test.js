// Porownanie statystyk dwoch graczy (web/src/lib/headToHeadStats.js).
//
// Testy pilnuja dwoch rzeczy, ktore koncza sie zaznaczeniem na zielono
// niewlasciwego gracza: odwroconego kierunku przy miejscu w rankingu
// i pustego miejsca traktowanego jak miejsce zerowe.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../web/src/lib/headToHeadStats.js";

test("wiecej znaczy lepiej w zwyklej statystyce", async () => {
  const { betterSide } = await import(MODUL);

  assert.equal(betterSide(42, 17), "a");
  assert.equal(betterSide(17, 42), "b");
});

test("rowne wartosci to remis, nie wygrana pierwszego", async () => {
  const { betterSide } = await import(MODUL);

  assert.equal(betterSide(10, 10), null);
  assert.equal(betterSide(0, 0), null);
});

test("w miejscu w rankingu mniej znaczy lepiej", async () => {
  const { betterSide } = await import(MODUL);

  assert.equal(betterSide(3, 40, { lowerIsBetter: true }), "a");
  assert.equal(betterSide(40, 3, { lowerIsBetter: true }), "b");
});

test("brak miejsca przegrywa z kazdym miejscem", async () => {
  // Gracz niesklasyfikowany ma rank === null. Gdyby null przeszedl przez
  // Number(), bylby zerem - czyli miejscem lepszym niz pierwsze.
  const { betterSide } = await import(MODUL);

  assert.equal(betterSide(null, 40, { lowerIsBetter: true }), "b");
  assert.equal(betterSide(40, null, { lowerIsBetter: true }), "a");
});

test("brak danych po obu stronach nie wskazuje nikogo", async () => {
  const { betterSide } = await import(MODUL);

  assert.equal(betterSide(null, null), null);
  assert.equal(betterSide(undefined, undefined), null);
});

test("zero to prawdziwa wartosc, a nie brak danych", async () => {
  const { betterSide } = await import(MODUL);

  assert.equal(betterSide(0, 5), "b");
  assert.equal(betterSide(5, 0), "a");
});

test("pasek dzieli sie proporcjonalnie do wygranych", async () => {
  const { splitWidths } = await import(MODUL);

  const { a, b, tie } = splitWidths({ wins_a: 5, wins_b: 3, ties: 2 });

  assert.equal(a, 50);
  assert.equal(b, 30);
  assert.equal(tie, 20);
});

test("bez rozegranych meczow pasek jest pusty, a nie podzielony po rowno", async () => {
  // Podzial po rowno sugerowalby remis, ktorego nie ma czym uzasadnic.
  const { splitWidths } = await import(MODUL);

  assert.deepEqual(splitWidths({ wins_a: 0, wins_b: 0, ties: 0 }), {
    a: 0,
    b: 0,
    tie: 0,
  });

  assert.deepEqual(splitWidths(), { a: 0, b: 0, tie: 0 });
});

test("same remisy wypelniaja pasek czescia neutralna", async () => {
  const { splitWidths } = await import(MODUL);

  assert.deepEqual(splitWidths({ wins_a: 0, wins_b: 0, ties: 4 }), {
    a: 0,
    b: 0,
    tie: 100,
  });
});

// --- punkty narastajaco -----------------------------------------------------

function mecz(nadpisania = {}) {
  return {
    match_id: 1,
    team_a: "FaZe",
    team_b: "Vitality",
    settled: true,
    a: { points: 0 },
    b: { points: 0 },
    ...nadpisania,
  };
}

test("punkty narastaja od poczatku turnieju, nie od konca", async () => {
  // Trasa oddaje mecze od najnowszego (ORDER BY id DESC), a wykres czyta sie
  // od lewej. Bez odwrocenia linia rosla by wstecz.
  const { duelProgress } = await import(MODUL);

  const { a } = duelProgress([
    mecz({ match_id: 3, a: { points: 1 } }),
    mecz({ match_id: 2, a: { points: 2 } }),
    mecz({ match_id: 1, a: { points: 5 } }),
  ]);

  assert.deepEqual(
    a.map((p) => p.total),
    [5, 7, 8],
  );
});

test("obie strony licza sie niezaleznie", async () => {
  const { duelProgress } = await import(MODUL);

  const { a, b } = duelProgress([
    mecz({ match_id: 2, a: { points: 5 }, b: { points: 0 } }),
    mecz({ match_id: 1, a: { points: 0 }, b: { points: 3 } }),
  ]);

  assert.deepEqual(a.map((p) => p.total), [0, 5]);
  assert.deepEqual(b.map((p) => p.total), [3, 3]);
});

test("mecz bez wyniku nie trafia na wykres", async () => {
  // Doliczony bylby plaskim odcinkiem udajacym, ze ktos przestal zdobywac
  // punkty - a on sie po prostu jeszcze nie odbyl.
  const { duelProgress } = await import(MODUL);

  const { a } = duelProgress([
    mecz({ match_id: 2, settled: false, a: { points: 0 } }),
    mecz({ match_id: 1, a: { points: 4 } }),
  ]);

  assert.equal(a.length, 1);
  assert.equal(a[0].total, 4);
});

test("numery meczow ida po kolei od jedynki", async () => {
  const { duelProgress } = await import(MODUL);

  const { a } = duelProgress([
    mecz({ match_id: 90, a: { points: 1 } }),
    mecz({ match_id: 50, a: { points: 1 } }),
    mecz({ match_id: 10, a: { points: 1 } }),
  ]);

  assert.deepEqual(a.map((p) => p.n), [1, 2, 3]);
});

test("brak meczow daje dwie puste serie, a nie wyjatek", async () => {
  const { duelProgress } = await import(MODUL);

  assert.deepEqual(duelProgress([]), { a: [], b: [] });
  assert.deepEqual(duelProgress(), { a: [], b: [] });
});
