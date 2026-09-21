// Tlum jako miara odniesienia (server/lib/crowdBaseline.js).
//
// Kazda liczba w serwisie jest bezwzgledna: "69% trafien" nie mowi, czy to
// duzo. Ta miara daje poprzeczke - co dalby najprostszy mozliwy sposob
// typowania, czyli chodzenie za wiekszoscia.
//
// Zmierzone na produkcji: w Kolonii tlum trafil 71 ze 106, co jest
// CZTERNASTYM wynikiem wsrod 48 osob, ktore wytypowaly co najmniej polowe
// meczow; w Krakowie 26 z 50 i miejsce 45 z 61.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/crowdBaseline.js";

function mecz(on_a, on_b, winner_a) {
  return { match_id: on_a * 1000 + on_b, on_a, on_b, winner_a: winner_a ? 1 : 0 };
}

// Cztery mecze, tlum trafia trzy - czyli 75%. Poprzeczka nizsza niz komplet,
// zeby bylo czym ja przeskoczyc.
const CZTERY_MECZE = [
  mecz(9, 1, true),
  mecz(9, 1, true),
  mecz(9, 1, true),
  mecz(1, 9, true),
];

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

test("miejsce tlumu liczy sie w SKUTECZNOSCI, nie w liczbie trafien", async () => {
  // To jest rozroznienie, na ktorym stoi cala ta miara. Trafien tlum ma
  // z definicji duzo, bo typuje KAZDY mecz - i to jest zasluga obecnosci,
  // nie oka. Ktos, kto wytypowal polowe turnieju bezblednie, czyta mecze
  // lepiej od tlumu, mimo ze trafien ma mniej.
  const { buildCrowdBaseline } = await import(MODUL);

  const w = buildCrowdBaseline({
    matches: CZTERY_MECZE, // tlum: 3/4 = 75%
    players: [
      // Mniej trafien niz tlum, ale wyzsza skutecznosc - to jest pobicie.
      { user_id: "1", displayname: "krotko a celnie", correct_winners: 2, total_predictions: 2 },
      // Tyle samo trafien i ten sam odsetek - remis to nie jest pobicie.
      { user_id: "2", displayname: "rowny", correct_winners: 3, total_predictions: 4 },
      // Wiecej typow, gorsze oko.
      { user_id: "3", displayname: "obecny", correct_winners: 2, total_predictions: 4 },
    ],
  });

  assert.equal(w.rank, 2, "jedna osoba przed tlumem");
  assert.deepEqual(
    w.beatenBy.map((p) => p.displayname),
    ["krotko a celnie"],
  );
});

test("stawka to ci, ktorzy PRZESZLI TURNIEJ razem z tlumem", async () => {
  // Dwa powody, oba zmierzone w Kolonii. Za same typy na fazy tez wchodzi
  // sie do klasyfikacji: 114 z 523 osob nie oddalo ani jednego typu
  // meczowego. A z pozostalych 409 az 163 oddalo DOKLADNIE JEDEN - i to
  // przy nich "szoste miejsce z 410" znaczylo glownie tyle, ze tlum byl
  // obecny.
  const { buildCrowdBaseline } = await import(MODUL);

  const w = buildCrowdBaseline({
    matches: CZTERY_MECZE, // prog to polowa, czyli 2 typy
    players: [
      { user_id: "1", correct_winners: 3, total_predictions: 4 },
      { user_id: "2", correct_winners: 1, total_predictions: 2 },
      { user_id: "3", correct_winners: 1, total_predictions: 1 }, // 100%, ale z jednego meczu
      { user_id: "4", correct_winners: 0, total_predictions: 0 }, // same fazy
    ],
  });

  assert.equal(w.players, 2, "dwoje w stawce, dwoje ponizej progu");
  assert.equal(w.threshold, 2, "prog idzie na front, zeby dalo sie go wyjasnic");
  assert.equal(
    w.rank,
    1,
    "stuprocentowy z jednego meczu nie wyprzedza tlumu, bo go w stawce nie ma",
  );
});

test("prog da sie podac z zewnatrz - jedno pojecie stawki na caly serwis", async () => {
  const { buildCrowdBaseline } = await import(MODUL);

  const w = buildCrowdBaseline({
    matches: CZTERY_MECZE,
    threshold: 4,
    players: [
      { user_id: "1", correct_winners: 4, total_predictions: 4 },
      { user_id: "2", correct_winners: 2, total_predictions: 2 },
    ],
  });

  assert.equal(w.threshold, 4);
  assert.equal(w.players, 1, "przy progu czterech typow zostaje jedna osoba");
});

test("pobici sortuja sie od najlepszego", async () => {
  const { buildCrowdBaseline } = await import(MODUL);

  const w = buildCrowdBaseline({
    matches: CZTERY_MECZE, // tlum 75%
    players: [
      { user_id: "1", correct_winners: 8, total_predictions: 10 },
      { user_id: "2", correct_winners: 2, total_predictions: 2 },
      { user_id: "3", correct_winners: 9, total_predictions: 10 },
    ],
  });

  assert.deepEqual(
    w.beatenBy.map((p) => p.accuracy),
    [100, 90, 80],
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
