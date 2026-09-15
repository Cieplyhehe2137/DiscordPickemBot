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
