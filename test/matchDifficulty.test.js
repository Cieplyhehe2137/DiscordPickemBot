// Trudnosc trafien (server/lib/matchDifficulty.js).
//
// Serwis mowi, KTO mial racje, i ani razu nie mowi, czy trzeba bylo ja miec.
// Zmierzone: 53 ze 155 meczow w bazie trafilo ponad 85% pola, a w Kolonii
// 55% wszystkich trafien lezy na 39 takich meczach.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/matchDifficulty.js";

const ZA_ZWYCIEZCE = 2;

// Domyslnie mecz oczywisty: 90 glosow na A, 10 na B, wygrywa A (90%).
function mecz({
  mine = false,
  mine_a = true,
  winner_a = true,
  on_a = 90,
  on_b = 10,
} = {}) {
  return {
    mine: mine ? 1 : 0,
    mine_a: mine_a ? 1 : 0,
    winner_a: winner_a ? 1 : 0,
    on_a,
    on_b,
  };
}

test("dzieli trafienia na oczywiste i zarobione", async () => {
  const { buildMatchDifficulty } = await import(MODUL);

  const w = buildMatchDifficulty({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: [
      // Oczywisty i trafiony.
      mecz({ mine: true, mine_a: true, winner_a: true }),
      // Trudny (50/50) i trafiony - to jest trafienie zarobione.
      mecz({ mine: true, mine_a: true, winner_a: true, on_a: 50, on_b: 50 }),
      // Oczywisty i NIE trafiony.
      mecz({ mine: true, mine_a: false, winner_a: true }),
      // Nie typowal.
      mecz({ mine: false }),
    ],
  });

  assert.equal(w.matches, 4);
  assert.equal(w.obvious, 3, "trzy mecze z 90% zgody");
  assert.equal(w.hits, 2);
  assert.equal(w.obviousHits, 1);
  assert.equal(w.earnedHits, 1);
  assert.equal(w.earnedPoints, 2);
  assert.equal(w.share, 50);
});

test("PROG 85% jest granica, a nie sugestia", async () => {
  const { buildMatchDifficulty, PROG_OCZYWISTEGO } = await import(MODUL);

  assert.equal(PROG_OCZYWISTEGO, 85);

  const dokladnie = buildMatchDifficulty({
    rows: [mecz({ mine: true, on_a: 85, on_b: 15 })],
  });
  const tuzPonizej = buildMatchDifficulty({
    rows: [mecz({ mine: true, on_a: 84, on_b: 16 })],
  });

  assert.equal(dokladnie.obvious, 1, "rowno 85% to juz oczywisty");
  assert.equal(dokladnie.obviousHits, 1);
  assert.equal(tuzPonizej.obvious, 0);
  assert.equal(tuzPonizej.earnedHits, 1);
});

test("mecz z garstka glosow NIE jest oczywisty, choc ma 100%", async () => {
  // Trzy osoby to nie jest pole. Ten sam prog stoi w upsets.js.
  const { buildMatchDifficulty, MIN_GLOSUJACYCH } = await import(MODUL);

  assert.equal(MIN_GLOSUJACYCH, 20);

  const w = buildMatchDifficulty({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: [mecz({ mine: true, on_a: 3, on_b: 0 })],
  });

  assert.equal(w.obvious, 0);
  assert.equal(
    w.earnedHits,
    1,
    "niesklasyfikowany wpada do zarobionych, zeby suma sie zgadzala",
  );
  assert.equal(w.obviousHits + w.earnedHits, w.hits);
});

test("STAWKA IDZIE Z ZEWNATRZ, nie jest wpisana w module", async () => {
  // rules/scoring.js jest jedynym zrodlem stalych punktowych.
  const { buildMatchDifficulty } = await import(MODUL);

  const rows = [mecz({ mine: true, on_a: 50, on_b: 50 })];

  assert.equal(buildMatchDifficulty({ rows, pointsPerWinner: 2 }).earnedPoints, 2);
  assert.equal(buildMatchDifficulty({ rows, pointsPerWinner: 5 }).earnedPoints, 5);
  assert.equal(
    buildMatchDifficulty({ rows }).earnedPoints,
    0,
    "bez stawki nie zgadujemy",
  );
});

test("udzial pola liczy sie z tych samych wierszy, bez zapytania", async () => {
  // on_a i on_b to juz sa trafienia wszystkich - porownanie „u Ciebie
  // kontra u nich" nie kosztuje ani jednej podrozy do bazy.
  const { buildMatchDifficulty } = await import(MODUL);

  const w = buildMatchDifficulty({
    rows: [
      // Oczywisty: 90 trafien pola.
      mecz({ winner_a: true, on_a: 90, on_b: 10 }),
      // Trudny: 30 trafien pola.
      mecz({ winner_a: true, on_a: 30, on_b: 70 }),
    ],
  });

  assert.equal(w.fieldShare, 75, "90 ze 120 trafien pola to mecz oczywisty");
});

test("miejsce wg zarobionych: remis daje to samo miejsce", async () => {
  const { miejsceWedlugZarobionych } = await import(MODUL);

  const pole = [
    { user_id: "a", earned: 38 },
    { user_id: "b", earned: 35 },
    { user_id: "c", earned: 35 },
    { user_id: "d", earned: 4 },
  ];

  assert.equal(miejsceWedlugZarobionych(pole, "a").rank, 1);
  assert.equal(miejsceWedlugZarobionych(pole, "b").rank, 2);
  assert.equal(miejsceWedlugZarobionych(pole, "c").rank, 2, "remis, nie #3");
  assert.equal(miejsceWedlugZarobionych(pole, "d").rank, 4);
  assert.equal(miejsceWedlugZarobionych(pole, "d").players, 4);
});

test("identyfikator gracza porownuje sie jako TEKST", async () => {
  // user_id to snowflake Discorda - osiemnascie cyfr. Number() gubi na nim
  // precyzje, wiec porownanie musi isc po tekscie.
  const { miejsceWedlugZarobionych } = await import(MODUL);

  const ID = "1008765321861140611";

  assert.notEqual(
    String(Number(ID)),
    ID,
    "ten identyfikator NIE przechodzi przez Number bez uszczerbku",
  );

  const pole = [
    { user_id: "1216263156742094870", earned: 38 },
    { user_id: ID, earned: 1 },
  ];

  assert.equal(miejsceWedlugZarobionych(pole, ID).rank, 2);
  assert.equal(miejsceWedlugZarobionych(pole, 1216263156742094870n).rank, 1);
  assert.equal(miejsceWedlugZarobionych(pole, "kogos-takiego-nie-ma"), null);
});

test("bez ANI JEDNEGO zarobionego trafienia miejsce znika", async () => {
  // "#217 z 409" przy zerze nie mowi o tym czlowieku nic - jest w calosci
  // policzone z tego, ilu innych zrobilo cokolwiek. Zmierzone: tak ma 193
  // z 409 osob w Kolonii.
  const { buildMatchDifficulty } = await import(MODUL);

  const pole = [
    { user_id: "kto-inny", earned: 12 },
    { user_id: "nasz", earned: 0 },
  ];

  const w = buildMatchDifficulty({
    rows: [mecz({ mine: true })], // trafienie, ale oczywiste
    fieldRows: pole,
    userId: "nasz",
  });

  assert.equal(w.earnedHits, 0);
  assert.equal(w.rank, null, "zero zarobionych to nie jest miejsce");
  assert.equal(w.players, null);
  assert.equal(w.enough, true, "reszta sekcji ma sie dalej pokazac");
});

test("bez danych pola sekcja dziala, tylko bez miejsca", async () => {
  const { buildMatchDifficulty } = await import(MODUL);

  const w = buildMatchDifficulty({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: [
      mecz({ mine: true }), // oczywisty
      mecz({ mine: true, on_a: 50, on_b: 50 }), // zarobiony
    ],
  });

  assert.equal(w.earnedHits, 1, "ma co plasowac, brakuje tylko pola");
  assert.equal(w.rank, null);
  assert.equal(w.players, null);
  assert.equal(w.enough, true, "brak miejsca nie chowa calej sekcji");
});

test("turniej bez meczow oczywistych nie ma o czym pisac", async () => {
  const { buildMatchDifficulty } = await import(MODUL);

  const w = buildMatchDifficulty({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: [mecz({ mine: true, on_a: 50, on_b: 50 })],
  });

  assert.equal(w.obvious, 0);
  assert.equal(w.enough, false);
});

test("gracz bez trafien nie dostaje rzedu zer", async () => {
  const { buildMatchDifficulty } = await import(MODUL);

  const w = buildMatchDifficulty({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: [mecz({ mine: true, mine_a: false, winner_a: true })],
  });

  assert.equal(w.hits, 0);
  assert.equal(w.share, null, "zero znaczyloby ze zadne nie bylo oczywiste");
  assert.equal(w.enough, false);
});

test("strona B liczy sie tak samo jak A", async () => {
  // Zgoda pola to odsetek na ZWYCIEZCE, nie na druzynie A.
  const { buildMatchDifficulty } = await import(MODUL);

  const w = buildMatchDifficulty({
    rows: [
      mecz({ mine: true, mine_a: false, winner_a: false, on_a: 5, on_b: 95 }),
    ],
  });

  assert.equal(w.obvious, 1, "95 glosow na B, wygrala B");
  assert.equal(w.obviousHits, 1);
});

test("brak wejscia nie wywraca liczenia", async () => {
  const { buildMatchDifficulty } = await import(MODUL);

  assert.equal(buildMatchDifficulty().hits, 0);
  assert.equal(buildMatchDifficulty({}).enough, false);
  assert.equal(buildMatchDifficulty({ rows: [null] }).matches, 0);
  assert.equal(buildMatchDifficulty({ rows: [mecz()], fieldRows: null }).rank, null);
});
