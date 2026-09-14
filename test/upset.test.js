// Karta "najwiekszy upset" na stronie eventu (web/src/lib/upset.js).
//
// Wynik przychodzi z serwera zawsze jako res_a:res_b - drozyna A do druzyny B.
// Karta wypisywala go doslownie obok nazwy zwyciezcy, wiec gdy wygrywala
// druzyna B, na IEM Cologne wychodzilo "9z wygral 1:2". Zdanie, ktore czyta
// sie jak literowka, a stoi na stronie eventu wysoko - widzi je kazdy, kto
// wejdzie z podeslanego linku.
//
// Modul nie importuje niczego, wiec dziala bez instalowania zaleznosci.

const test = require("node:test");
const assert = require("node:assert/strict");

const UPSET = "../web/src/lib/upset.js";

// Prawdziwy przypadek z produkcji: Vitality 100% typow, 9z 0%, wygralo 9z.
const COLOGNE = {
  team_a: "Vitality",
  team_b: "9z",
  res_a: 1,
  res_b: 2,
  winner: "9z",
  winner_percentage: 0,
  total_picks: 41,
};

test("gdy wygrywa druzyna B, jej liczba idzie z przodu", async () => {
  const { winnerFirstScore } = await import(UPSET);

  assert.equal(
    winnerFirstScore(COLOGNE),
    "2:1",
    'przedtem wychodzilo "9z wygral 1:2"',
  );
});

test("gdy wygrywa druzyna A, kolejnosc zostaje bez zmian", async () => {
  const { winnerFirstScore } = await import(UPSET);

  assert.equal(
    winnerFirstScore({ ...COLOGNE, winner: "Vitality", res_a: 2, res_b: 1 }),
    "2:1",
  );
});

test("zwyciezca nie pasujacy do zadnej strony zostawia wynik surowy", async () => {
  // Stare dane potrafia miec nazwe, ktorej nie ma juz w meczu. Lepiej pokazac
  // wynik tak, jak przyszedl, niz zgadnac i odwrocic go w zla strone.
  const { winnerFirstScore } = await import(UPSET);

  assert.equal(winnerFirstScore({ ...COLOGNE, winner: "ktos inny" }), "1:2");
  assert.equal(winnerFirstScore({ ...COLOGNE, winner: null }), "1:2");
});

test("brak wyniku to null, nie napis z NaN", async () => {
  const { winnerFirstScore } = await import(UPSET);

  assert.equal(winnerFirstScore({ ...COLOGNE, res_a: null }), null);
  assert.equal(winnerFirstScore({ ...COLOGNE, res_b: undefined }), null);
  assert.equal(winnerFirstScore(null), null);
});

test("wynik podany tekstem tez sie liczy", async () => {
  // mysql2 potrafi oddac liczby jako napisy.
  const { winnerFirstScore } = await import(UPSET);

  assert.equal(winnerFirstScore({ ...COLOGNE, res_a: "1", res_b: "2" }), "2:1");
});

test("zero procent znaczy, ze nie trafil nikt", async () => {
  const { nobodyPickedWinner } = await import(UPSET);

  assert.equal(nobodyPickedWinner(COLOGNE), true);
});

test("ulamek procenta to NIE jest nikt", async () => {
  // Przy 41 typach jeden trafiony to 2.4%, ale przy tysiacu - 0.1%.
  // Napisanie wtedy "nikt nie przewidzial" byloby nieprawda wobec tej osoby,
  // ktora przewidziala.
  const { nobodyPickedWinner } = await import(UPSET);

  assert.equal(nobodyPickedWinner({ ...COLOGNE, winner_percentage: 0.4 }), false);
  assert.equal(nobodyPickedWinner({ ...COLOGNE, winner_percentage: 3 }), false);
});

test("brak danych nie udaje, ze nikt nie trafil", async () => {
  const { nobodyPickedWinner } = await import(UPSET);

  assert.equal(nobodyPickedWinner({}), false);
  assert.equal(nobodyPickedWinner(null), false);
});
