// Rozbijanie listy typow z formularza.
//
// Drobne, ale stoi na wejsciu kazdego typowania fazowego - to przez nie
// przechodza nazwy druzyn, zanim trafia do walidacji limitow.

const test = require("node:test");
const assert = require("node:assert/strict");

const PICKS = "../server/lib/picks.js";

test("rozbija liste po przecinku i przycina spacje", async () => {
  const { parseCsvPick } = await import(PICKS);

  assert.deepEqual(parseCsvPick("NAVI,Vitality"), ["NAVI", "Vitality"]);
  assert.deepEqual(parseCsvPick(" NAVI , Vitality "), ["NAVI", "Vitality"]);
});

test("puste elementy wypadaja, zamiast psuc caly typ", async () => {
  const { parseCsvPick } = await import(PICKS);

  // Podwojny przecinek i przecinek na koncu to normalna rzecz w polu
  // tekstowym, a nie powod, zeby odrzucic zgloszenie.
  assert.deepEqual(parseCsvPick("NAVI,,Vitality"), ["NAVI", "Vitality"]);
  assert.deepEqual(parseCsvPick("NAVI,"), ["NAVI"]);
  assert.deepEqual(parseCsvPick(",,,"), []);
});

test("brak wartosci to pusta lista, a nie wyjatek", async () => {
  const { parseCsvPick } = await import(PICKS);

  assert.deepEqual(parseCsvPick(null), []);
  assert.deepEqual(parseCsvPick(undefined), []);
  assert.deepEqual(parseCsvPick(""), []);
});

test("pojedyncza nazwa bez przecinka tez jest lista", async () => {
  const { parseCsvPick } = await import(PICKS);

  assert.deepEqual(parseCsvPick("NAVI"), ["NAVI"]);
});
