// Punkty narastajaco (server/lib/pointsProgress.js).
//
// Wejsciem sa wiersze tego samego zapytania, ktore liczy serie trafien.
// Testy pilnuja tego, co przy prawdziwych danych daje wykres wygladajacy
// jak prawda: sumy liczonej od konca turnieju i NULL-a z LEFT JOIN-a
// traktowanego jak liczba.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/pointsProgress.js";

function wiersz(points, nadpisania = {}) {
  return {
    match_id: 1,
    team_a: "FaZe",
    team_b: "Vitality",
    points,
    ...nadpisania,
  };
}

test("suma rosnie mecz po meczu", async () => {
  const { buildProgress } = await import(MODUL);

  const ciag = buildProgress([wiersz(5), wiersz(0), wiersz(3)]);

  assert.deepEqual(
    ciag.map((p) => p.total),
    [5, 5, 8],
  );
});

test("kazdy punkt zna tez swoj wlasny wynik, nie tylko sume", async () => {
  // Dymek ma pokazac "+3 pkt, razem 8", a nie samo 8.
  const { buildProgress } = await import(MODUL);

  const ciag = buildProgress([wiersz(5), wiersz(3)]);

  assert.equal(ciag[1].points, 3);
  assert.equal(ciag[1].total, 8);
});

test("NULL z LEFT JOIN-a liczy sie jako zero", async () => {
  // match_points nie ma wiersza dla meczu, za ktory nikt nic nie dostal.
  const { buildProgress } = await import(MODUL);

  const ciag = buildProgress([wiersz(4), wiersz(null), wiersz(2)]);

  assert.deepEqual(
    ciag.map((p) => p.total),
    [4, 4, 6],
  );

  assert.equal(ciag[1].points, 0);
});

test("numer punktu to pozycja w turnieju, a nie id meczu", async () => {
  // Identyfikatory meczow zaczynaja sie na produkcji od pieciuset
  // czterdziestu - na osi ma stac "ktory to byl mecz".
  const { buildProgress } = await import(MODUL);

  const ciag = buildProgress([
    wiersz(1, { match_id: 540 }),
    wiersz(1, { match_id: 541 }),
  ]);

  assert.deepEqual(
    ciag.map((p) => p.n),
    [1, 2],
  );

  assert.equal(ciag[0].match_id, 540);
});

test("etykieta sklada sie z obu druzyn", async () => {
  const { buildProgress } = await import(MODUL);

  const [p] = buildProgress([wiersz(2)]);

  assert.equal(p.label, "FaZe vs Vitality");
});

test("brak nazw druzyn daje null, a nie 'undefined vs undefined'", async () => {
  const { buildProgress } = await import(MODUL);

  const [p] = buildProgress([wiersz(2, { team_a: null, team_b: null })]);

  assert.equal(p.label, null);
});

test("pusta lista daje pusty ciag, a nie wyjatek", async () => {
  const { buildProgress } = await import(MODUL);

  assert.deepEqual(buildProgress([]), []);
  assert.deepEqual(buildProgress(null), []);
  assert.deepEqual(buildProgress(undefined), []);
});

test("same zera daja ciag zer, a nie pusty wykres", async () => {
  // Tak wyglada kazdy, kto zapisal sie na turniej i nie trafil nic.
  const { buildProgress } = await import(MODUL);

  const ciag = buildProgress([wiersz(0), wiersz(0), wiersz(0)]);

  assert.equal(ciag.length, 3);
  assert.deepEqual(
    ciag.map((p) => p.total),
    [0, 0, 0],
  );
});
