// Ile kosztowala nieobecnosc (server/lib/absence.js).
//
// Caly serwis liczy to, co ktos zrobil. Ani jedna liczba nie mowila o tym,
// czego nie zrobil - a to jest w tych danych zjawisko pierwszego rzedu:
// w IEM Cologne mediana typujacego pominela 103 ze 106 meczow, komplet
// wytypowaly CZTERY osoby, a lacznie pominiec bylo 36 930.
//
// Zmierzone: rekordzista zyskalby +142 pkt i skoczyl o 47 miejsc, a 399
// z 409 osob zmienilo by miejsce w rankingu.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/absence.js";

const ZA_ZWYCIEZCE = 2;

function mecz({ mine = false, winner_a = true, on_a = 9, on_b = 1 } = {}) {
  return {
    mine: mine ? 1 : 0,
    winner_a: winner_a ? 1 : 0,
    on_a,
    on_b,
  };
}

test("liczy tylko mecze BEZ typu tego gracza", async () => {
  const { buildAbsence } = await import(MODUL);

  const w = buildAbsence({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: [
      // Wytypowane - nie wchodza do ceny, nawet jesli tlum trafil.
      mecz({ mine: true, winner_a: true, on_a: 9, on_b: 1 }),
      mecz({ mine: true, winner_a: false, on_a: 9, on_b: 1 }),
      // Pominiete.
      mecz({ mine: false, winner_a: true, on_a: 9, on_b: 1 }), // tlum trafil
      mecz({ mine: false, winner_a: false, on_a: 9, on_b: 1 }), // tlum sie mylil
    ],
  });

  assert.equal(w.settled, 4);
  assert.equal(w.picked, 2);
  assert.equal(w.skipped, 2);
  assert.equal(w.crowdHits, 1, "z dwoch pominietych tlum trafil jeden");
  assert.equal(w.points, 2);
});

test("STAWKA IDZIE Z ZEWNATRZ, nie jest wpisana w module", async () => {
  // rules/scoring.js jest jedynym zrodlem stalych punktowych. Wpisanie
  // dwojki tutaj dawaloby drugie miejsce, w ktorym trzeba pamietac
  // o zmianie regulaminu.
  const { buildAbsence } = await import(MODUL);

  const rows = [mecz({ mine: false, winner_a: true })];

  assert.equal(buildAbsence({ rows, pointsPerWinner: 2 }).points, 2);
  assert.equal(buildAbsence({ rows, pointsPerWinner: 5 }).points, 5);
  assert.equal(buildAbsence({ rows }).points, 0, "bez stawki nie zgadujemy");
});

test("pokrycie mowi, ILE turnieju ten czlowiek w ogole obejrzal", async () => {
  // Bez tego "+142 pkt" nie mowi, czy ktos pominal piec meczow, czy sto piec.
  const { buildAbsence } = await import(MODUL);

  const w = buildAbsence({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: [
      mecz({ mine: true }),
      mecz({ mine: true }),
      mecz({ mine: true }),
      mecz({ mine: false }),
    ],
  });

  assert.equal(w.coverage, 75);
});

test("komplet nie ma o czym pisac", async () => {
  // Cztery osoby w Kolonii, pietnascie w Krakowie. Dla nich sekcja znika,
  // zamiast pokazywac rzad zer.
  const { buildAbsence } = await import(MODUL);

  const w = buildAbsence({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: [mecz({ mine: true }), mecz({ mine: true })],
  });

  assert.equal(w.skipped, 0);
  assert.equal(w.enough, false);
  assert.equal(w.coverage, 100);
});

test("remis glosow rozstrzyga sie na A - tak samo jak przy tlumie", async () => {
  // Wybor arbitralny, wiec jawny i JEDEN na caly serwis. Zmierzone:
  // w bazie taki remis nie zdarzyl sie ani razu na 156 meczach.
  const { buildAbsence } = await import(MODUL);

  const naA = buildAbsence({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: [mecz({ mine: false, winner_a: true, on_a: 5, on_b: 5 })],
  });

  const naB = buildAbsence({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: [mecz({ mine: false, winner_a: false, on_a: 5, on_b: 5 })],
  });

  assert.equal(naA.crowdHits, 1);
  assert.equal(naB.crowdHits, 0);
});

test("gracz, ktory nie typowal NICZEGO, dostaje pelna cene", async () => {
  // Skrajny przypadek i wcale nie rzadki: 163 osoby w Kolonii oddaly
  // dokladnie jeden typ na 106 meczow.
  const { buildAbsence } = await import(MODUL);

  const w = buildAbsence({
    pointsPerWinner: ZA_ZWYCIEZCE,
    rows: Array.from({ length: 10 }, () => mecz({ mine: false, winner_a: true })),
  });

  assert.equal(w.picked, 0);
  assert.equal(w.coverage, 0);
  assert.equal(w.crowdHits, 10);
  assert.equal(w.points, 20);
  assert.equal(w.enough, true);
});

test("turniej bez rozstrzygnietych meczow nie udaje zerowego pokrycia", async () => {
  const { buildAbsence } = await import(MODUL);

  const w = buildAbsence({ rows: [], pointsPerWinner: ZA_ZWYCIEZCE });

  assert.equal(w.settled, 0);
  assert.equal(w.coverage, null, "brak meczow to nie jest zerowe pokrycie");
  assert.equal(w.enough, false);
});

test("brak wejscia nie wywraca liczenia", async () => {
  const { buildAbsence } = await import(MODUL);

  assert.equal(buildAbsence().skipped, 0);
  assert.equal(buildAbsence({}).points, 0);
  assert.equal(buildAbsence({ rows: [null], pointsPerWinner: 2 }).settled, 0);
});
