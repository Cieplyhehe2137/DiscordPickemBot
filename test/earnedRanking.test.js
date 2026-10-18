// Trzecia os rankingu: trafienia zarobione (server/lib/earnedRanking.js).
//
// PO CO TA TABELA. Ranking punktowy w duzej mierze mierzy obecnosc,
// skutecznosc mierzy odsetek trafien, a zadne z dwojga nie pyta, czy te
// trafienia byly trudne. Trafiony zwyciezca to te same dwa punkty, czy
// wskazalo go cale pole, czy cztery procent.
//
// CZYM TO MOZE SIE ZEPSUC, a czego nie widac na ekranie:
//
//   kolejnosc po punktach zamiast po zarobionych -> tabela wyglada jak
//       ranking punktowy z inna naglowkiem i nikt nie zauwazy,
//   gracz z zerem zarobionych w tabeli -> polowa stawki to wiersze, ktore
//       nie mowia o czlowieku nic (w Kolonii 193 z 409 osob),
//   stawka wpisana w module -> punkty zarobione rozjada sie z kafelkiem na
//       profilu, ktory bierze ja z rules/scoring.js.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MODUL = "../server/lib/earnedRanking.js";

const WINNER = 2;

function player(id, points, rank) {
  return { user_id: id, displayname: `gracz ${id}`, total_points: points, rank };
}

function earned(pairs) {
  return new Map(pairs.map(([id, hits]) => [String(id), hits]));
}

test("kolejnosc idzie po zarobionych, nie po punktach", async () => {
  const { buildEarnedRanking } = await import(MODUL);

  // Sedno sprawy: "a" ma wiecej punktow, "b" wiecej zarobionych trafien.
  const wynik = buildEarnedRanking({
    players: [player("a", 300, 1), player("b", 200, 2)],
    earnedByUser: earned([["a", 10], ["b", 25]]),
    pointsPerHit: WINNER,
  });

  assert.deepEqual(
    wynik.rows.map((w) => w.user_id),
    ["b", "a"],
  );

  assert.equal(wynik.rows[0].rank, 1);
  assert.equal(wynik.rows[1].rank, 2);
});

test("miejsce punktowe zostaje zapamietane", async () => {
  const { buildEarnedRanking } = await import(MODUL);

  const wynik = buildEarnedRanking({
    players: [player("a", 300, 9), player("b", 200, 16)],
    earnedByUser: earned([["a", 5], ["b", 30]]),
    pointsPerHit: WINNER,
  });

  // Po to sie tu przychodzi: trzecie miejsce wedlug zarobionych stoi
  // punktowo na dziewiatym.
  assert.equal(wynik.rows[0].points_rank, 16);
  assert.equal(wynik.rows[1].points_rank, 9);
});

test("zero zarobionych trafien nie wchodzi do tabeli", async () => {
  const { buildEarnedRanking } = await import(MODUL);

  const wynik = buildEarnedRanking({
    players: [player("a", 300, 1), player("b", 200, 2), player("c", 100, 3)],
    earnedByUser: earned([["a", 4], ["b", 0]]),
    pointsPerHit: WINNER,
  });

  // "b" ma jawne zero, "c" nie ma wiersza wcale - oba znaczy to samo.
  assert.deepEqual(
    wynik.rows.map((w) => w.user_id),
    ["a"],
  );

  assert.equal(wynik.players, 1);
});

test("remis na zarobionych rozstrzyga suma punktow", async () => {
  const { buildEarnedRanking } = await import(MODUL);

  const wynik = buildEarnedRanking({
    players: [player("a", 100, 5), player("b", 300, 1)],
    earnedByUser: earned([["a", 7], ["b", 7]]),
    pointsPerHit: WINNER,
  });

  assert.deepEqual(
    wynik.rows.map((w) => w.user_id),
    ["b", "a"],
  );
});

test("punkty zarobione licza sie stawka podana z zewnatrz", async () => {
  const { buildEarnedRanking } = await import(MODUL);

  const wynik = buildEarnedRanking({
    players: [player("a", 300, 1)],
    earnedByUser: earned([["a", 11]]),
    pointsPerHit: WINNER,
  });

  assert.equal(wynik.rows[0].earned_hits, 11);
  assert.equal(wynik.rows[0].earned_points, 22);
  assert.equal(wynik.pointsPerHit, WINNER);
});

test("brak stawki nie wywraca tabeli, tylko zeruje punkty", async () => {
  const { buildEarnedRanking } = await import(MODUL);

  const wynik = buildEarnedRanking({
    players: [player("a", 300, 1)],
    earnedByUser: earned([["a", 11]]),
  });

  assert.equal(wynik.rows[0].earned_hits, 11);
  assert.equal(wynik.rows[0].earned_points, 0);
});

test("braki i smieci koncza sie pusta tabela, a nie wyjatkiem", async () => {
  const { buildEarnedRanking } = await import(MODUL);

  for (const wejscie of [undefined, {}, { players: null }, { players: [null] }]) {
    const wynik = buildEarnedRanking(wejscie);

    assert.deepEqual(wynik.rows, []);
    assert.equal(wynik.players, 0);
  }
});

test("skala tabeli idzie w odpowiedzi: ile meczow i ile oczywistych", async () => {
  const { buildEarnedRanking } = await import(MODUL);

  const wynik = buildEarnedRanking({
    players: [player("a", 300, 1)],
    earnedByUser: earned([["a", 3]]),
    pointsPerHit: WINNER,
    matches: 106,
    obvious: 39,
  });

  // Bez tych dwoch liczb "3 zarobione" nie ma skali.
  assert.equal(wynik.matches, 106);
  assert.equal(wynik.obvious, 39);
});

test("prog oczywistego ma JEDNO zrodlo takze w trasie rankingu", () => {
  // To samo zastrzezenie, co przy trasie profilu w scoringContract.test.js:
  // wpisanie progow do SQL-a dawaloby druga regule, ktora rozjedzie sie bez
  // zadnego bledu - ranking liczylby inne mecze jako oczywiste niz kafelek
  // na profilu tego samego gracza.
  const trasa = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "events.js"),
    "utf8",
  );

  assert.ok(
    trasa.includes("[MIN_GLOSUJACYCH, PROG_OCZYWISTEGO, slug, slug]"),
    "zapytanie o zarobione nie bierze progow z lib/matchDifficulty.js",
  );

  assert.ok(
    trasa.includes("pointsPerHit: scoring?.MATCH?.WINNER"),
    "trasa rankingu nie podaje stawki z rules/scoring.js",
  );
});
