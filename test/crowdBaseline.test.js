// Tlum jako miara odniesienia (server/lib/crowdBaseline.js).
//
// Kazda liczba w serwisie jest bezwzgledna: "69% trafien" nie mowi, czy to
// duzo. Ta miara daje poprzeczke - co dalby najprostszy mozliwy sposob
// typowania, czyli chodzenie za wiekszoscia.
//
// Zmierzone na produkcji: w Kolonii tlum trafil 71 ze 106 i zajalby SZOSTE
// miejsce na 410 typujacych; w Krakowie 26 z 50 i miejsce 28 z 252.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/crowdBaseline.js";

function mecz(on_a, on_b, winner_a) {
  return { match_id: on_a * 1000 + on_b, on_a, on_b, winner_a: winner_a ? 1 : 0 };
}

test("tlum trafia tam, gdzie wiekszosc miala racje", async () => {
  const { buildCrowdBaseline } = await import(MODUL);

  const w = buildCrowdBaseline({
    matches: [
      mecz(80, 20, true), // wiekszosc na A, wygrala A
      mecz(30, 70, true), // wiekszosc na B, wygrala A
      mecz(10, 90, false), // wiekszosc na B, wygrala B
    ],
  });

  assert.equal(w.matches, 3);
  assert.equal(w.correct, 2);
  assert.equal(w.accuracy, 67);
});

test("miejsce tlumu liczy sie w TRAFIENIACH, nie w punktach", async () => {
  // Rozroznienie jest istotne: ranking liczy tez dokladne wyniki map i typy
  // na fazy, ktorych ta miara w ogole nie dotyczy. Gdyby wstawic tlum do
  // rankingu punktowego, porownywalby sie z czyms, czego nie robi.
  const { buildCrowdBaseline } = await import(MODUL);

  const w = buildCrowdBaseline({
    matches: [mecz(9, 1, true), mecz(9, 1, true)],
    players: [
      { user_id: "1", displayname: "lepszy", correct_winners: 3, total_predictions: 3 },
      { user_id: "2", displayname: "rowny", correct_winners: 2, total_predictions: 3 },
      { user_id: "3", displayname: "gorszy", correct_winners: 1, total_predictions: 3 },
    ],
  });

  assert.equal(w.correct, 2);
  assert.equal(w.rank, 2, "jedna osoba przed tlumem");
  assert.deepEqual(
    w.beatenBy.map((p) => p.displayname),
    ["lepszy"],
    "rowny wynik to nie jest pobicie tlumu",
  );
});

test("stawka to ci, ktorzy typowali MECZE - nie wszyscy sklasyfikowani", async () => {
  // Do klasyfikacji wchodzi sie tez za same typy na fazy: w Kolonii 114
  // z 523 osob nie oddalo ani jednego typu meczowego. Liczenie ich dawalo
  // "szoste miejsce z 524" i sugerowalo, ze tlum wyprzedzil pieciuset
  // ludzi - podczas gdy stu czternastu w tej konkurencji nie startowalo.
  const { buildCrowdBaseline } = await import(MODUL);

  const w = buildCrowdBaseline({
    matches: [mecz(9, 1, true)],
    players: [
      { user_id: "1", correct_winners: 1, total_predictions: 1 },
      { user_id: "2", correct_winners: 0, total_predictions: 1 },
      { user_id: "3", correct_winners: 0, total_predictions: 0 },
      { user_id: "4", correct_winners: 0, total_predictions: 0 },
    ],
  });

  assert.equal(w.players, 2, "dwoje typowalo mecze, dwoje tylko fazy");
});

test("pobici sortuja sie od najlepszego", async () => {
  const { buildCrowdBaseline } = await import(MODUL);

  const w = buildCrowdBaseline({
    matches: [mecz(9, 1, true)],
    players: [
      { user_id: "1", correct_winners: 2, total_predictions: 9 },
      { user_id: "2", correct_winners: 9, total_predictions: 9 },
      { user_id: "3", correct_winners: 5, total_predictions: 9 },
    ],
  });

  assert.deepEqual(
    w.beatenBy.map((p) => p.correct_winners),
    [9, 5, 2],
  );
});

test("turniej bez rozstrzygnietych meczow nie udaje zera procent", async () => {
  const { buildCrowdBaseline } = await import(MODUL);

  const w = buildCrowdBaseline({ matches: [], players: [] });

  assert.equal(w.matches, 0);
  assert.equal(w.accuracy, null, "brak meczow to nie jest zerowa skutecznosc");
  assert.equal(w.rank, 1);
});

test("remis glosow rozstrzyga sie na A - jawnie, nie przypadkiem", async () => {
  // W bazie nie zdarzyl sie ani raz na 156 meczach. Alternatywa - pominiecie
  // meczu - dawalaby tlumowi mniej okazji niz ludziom, czyli porownywalaby
  // dwie rozne rzeczy.
  const { buildCrowdBaseline } = await import(MODUL);

  assert.equal(buildCrowdBaseline({ matches: [mecz(5, 5, true)] }).correct, 1);
  assert.equal(buildCrowdBaseline({ matches: [mecz(5, 5, false)] }).correct, 0);
});

// --- jeden gracz wobec tlumu ------------------------------------------------

function typ({ mine_a, winner_a, on_a, on_b }) {
  return {
    mine_a: mine_a ? 1 : 0,
    winner_a: winner_a ? 1 : 0,
    on_a,
    on_b,
  };
}

test("wlasny glos NIE liczy sie do wiekszosci", async () => {
  // Bez tego kazdy startowalby z przewaga jednego glosu po swojej stronie -
  // i tym wieksza, im mniej osob typowalo dany mecz.
  const { buildPlayerVsCrowd } = await import(MODUL);

  // Gracz na A, poza nim 2 na A i 3 na B. Wiekszosc bez niego jest na B.
  const w = buildPlayerVsCrowd([
    typ({ mine_a: true, winner_a: true, on_a: 3, on_b: 3 }),
  ]);

  assert.equal(w.correct, 1, "gracz trafil");
  assert.equal(w.crowd, 0, "tlum bez niego byl na B i sie pomylil");
  assert.equal(w.advantage, 1);
});

test("mecz bez wiekszosci wypada z porownania po OBU stronach", async () => {
  // Po odjeciu wlasnego glosu potrafi zostac remis. Zaliczenie graczowi
  // trafienia w meczu, w ktorym tlum nie mial zdania, porownywaloby go
  // z niczym.
  const { buildPlayerVsCrowd } = await import(MODUL);

  const w = buildPlayerVsCrowd([
    typ({ mine_a: true, winner_a: true, on_a: 4, on_b: 3 }), // bez niego 3:3
    typ({ mine_a: true, winner_a: true, on_a: 9, on_b: 1 }),
  ]);

  assert.equal(w.matches, 1, "liczy sie tylko drugi mecz");
  assert.equal(w.tied, 1);
  assert.equal(w.correct, 1);
  assert.equal(w.crowd, 1);
  assert.equal(w.advantage, 0);
});

test("przewaga bywa ujemna i tak ma byc", async () => {
  // Zmierzone: w Kolonii 75% graczy wypada ponizej tlumu. To jest ta
  // informacja, ktorej strona dzis nie ma.
  const { buildPlayerVsCrowd } = await import(MODUL);

  const w = buildPlayerVsCrowd([
    typ({ mine_a: true, winner_a: false, on_a: 1, on_b: 9 }),
    typ({ mine_a: true, winner_a: false, on_a: 1, on_b: 9 }),
  ]);

  assert.equal(w.correct, 0);
  assert.equal(w.crowd, 2);
  assert.equal(w.advantage, -2);
});

test("ponizej progu liczba jest szumem i widok ma o tym wiedziec", async () => {
  const { buildPlayerVsCrowd, MIN_TYPOW } = await import(MODUL);

  const jeden = buildPlayerVsCrowd([
    typ({ mine_a: true, winner_a: true, on_a: 9, on_b: 1 }),
  ]);

  assert.equal(jeden.enough, false);

  const duzo = buildPlayerVsCrowd(
    Array.from({ length: MIN_TYPOW }, () =>
      typ({ mine_a: true, winner_a: true, on_a: 9, on_b: 1 }),
    ),
  );

  assert.equal(duzo.enough, true);
  assert.equal(duzo.matches, MIN_TYPOW);
});

test("brak wejscia nie wywraca liczenia", async () => {
  const { buildCrowdBaseline, buildPlayerVsCrowd } = await import(MODUL);

  assert.equal(buildCrowdBaseline().correct, 0);
  assert.equal(buildCrowdBaseline({}).rank, 1);
  assert.equal(buildPlayerVsCrowd().matches, 0);
  assert.equal(buildPlayerVsCrowd([null]).matches, 0);
});
