// Ranking ze skutecznosci (server/lib/accuracyRanking.js).
//
// Ranking turnieju sortuje po sumie punktow, a punkty rosna z kazdym
// oddanym typem - wiec w duzej mierze mierzy OBECNOSC. Zmierzone w IEM
// Cologne Major 2026 na 106 rozstrzygnietych meczach: mediana typujacego
// pominela 103 z nich, 163 osoby oddaly dokladnie jeden typ, a komplet
// wytypowaly cztery. Ta tabela uklada tych samych ludzi po odsetku trafien.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/accuracyRanking.js";

function gracz(user_id, total_predictions, correct_winners, reszta = {}) {
  return { user_id, total_predictions, correct_winners, ...reszta };
}

test("prog liczy sie z MECZOW, a nie jest stala liczba", async () => {
  const { progTypow } = await import(MODUL);

  assert.equal(progTypow(106), 53, "Kolonia");
  assert.equal(progTypow(50), 25, "Krakow");

  // Stala liczba znaczylaby w tych dwoch turniejach co innego: 25 typow to
  // polowa Krakowa i niecala czwarta czesc Kolonii.
  assert.notEqual(progTypow(106), progTypow(50));

  assert.equal(progTypow(1), 1, "przy jednym meczu prog nie moze wyjsc zerowy");
  assert.equal(progTypow(0), 0, "turniej bez meczow nie ma z czego zbudowac progu");
});

test("tabela uklada po ODSETKU trafien, nie po punktach", async () => {
  const { buildAccuracyRanking } = await import(MODUL);

  const w = buildAccuracyRanking({
    matches: 10,
    players: [
      gracz("obecny", 10, 6, { rank: 1, total_points: 300 }),
      gracz("celny", 6, 5, { rank: 40, total_points: 120 }),
    ],
  });

  assert.deepEqual(
    w.rows.map((r) => r.user_id),
    ["celny", "obecny"],
    "83% stoi nad 60%, mimo ze punktow jest o polowe mniej",
  );
});

test("wiersz pamieta, SKAD przyszedl", async () => {
  // To jest cala informacja, po ktora sie tu przychodzi: piata skutecznosc
  // turnieju stoi punktowo na czterdziestym piatym miejscu (kakarucza,
  // 37/54 w Kolonii). Bez miejsca punktowego widac tylko kolejna tabele.
  const { buildAccuracyRanking } = await import(MODUL);

  const w = buildAccuracyRanking({
    matches: 10,
    players: [
      gracz("a", 10, 9, { rank: 45 }),
      gracz("b", 10, 5, { rank: 1 }),
    ],
  });

  assert.equal(w.rows[0].rank, 1, "miejsce nadane od nowa");
  assert.equal(w.rows[0].points_rank, 45, "i zapamietane stare");
  assert.equal(w.rows[1].rank, 2);
  assert.equal(w.rows[1].points_rank, 1);
});

test("ponizej progu nie wchodzi sie do tabeli", async () => {
  // Bez progu czolowke zajeliby ludzie z jednym szczesliwym typem:
  // 100% z jednego meczu stanaloby nad siedemdziesiecioma procentami
  // ze stu trzech.
  const { buildAccuracyRanking } = await import(MODUL);

  const w = buildAccuracyRanking({
    matches: 10, // prog: 5 typow
    players: [
      gracz("szczesciarz", 1, 1),
      gracz("polowa", 5, 3),
      gracz("komplet", 10, 7),
    ],
  });

  assert.equal(w.threshold, 5);
  assert.equal(w.players, 2);
  assert.deepEqual(
    w.rows.map((r) => r.user_id),
    ["komplet", "polowa"],
    "stuprocentowy z jednego meczu nie stoi na szczycie, bo go tu nie ma",
  );
});

test("o kolejnosci decyduje DOKLADNY ulamek, nie zaokraglony procent", async () => {
  // 67.6% i 67.9% to oba "68%" w polu accuracy. Gdyby tabela sortowala po
  // nim, o miejscu decydowalaby przypadkowa kolejnosc wierszy z bazy.
  const { buildAccuracyRanking } = await import(MODUL);

  const w = buildAccuracyRanking({
    matches: 200,
    players: [
      // Oba maja w bazie accuracy = 68, ale 70/102 to wiecej niz 70/103.
      gracz("gorszy", 103, 70, { accuracy: 68 }), // 67.96%
      gracz("lepszy", 102, 70, { accuracy: 68 }), // 68.63%
    ],
  });

  assert.deepEqual(
    w.rows.map((r) => r.user_id),
    ["lepszy", "gorszy"],
  );
});

test("przy rownej skutecznosci wyzej stoi wiekszy dorobek", async () => {
  // Ten sam wynik z wiekszej proby jest mocniejszym wynikiem. Dalej
  // rozstrzyga to, co ranking punktowy - zeby dwa widoki tej samej tabeli
  // nie opowiadaly o jednej parze graczy dwoch roznych historii.
  const { buildAccuracyRanking } = await import(MODUL);

  const w = buildAccuracyRanking({
    matches: 20,
    players: [
      gracz("malo", 10, 7, { total_points: 90 }),
      gracz("duzo", 20, 14, { total_points: 50 }),
      gracz("malo_ale_punkty", 10, 7, { total_points: 200 }),
    ],
  });

  assert.deepEqual(
    w.rows.map((r) => r.user_id),
    ["duzo", "malo_ale_punkty", "malo"],
  );
});

test("turniej z samych faz nie dostaje tabeli samych zer", async () => {
  // StarLadder Budapest 2025: 509 graczy, zero rozstrzygnietych meczow.
  // Skutecznosc nie ma tam z czego powstac i ma to byc pusta stawka,
  // a nie piecset wierszy po 0%.
  const { buildAccuracyRanking } = await import(MODUL);

  const w = buildAccuracyRanking({
    matches: 0,
    players: [gracz("ktos", 0, 0), gracz("ktos2", 0, 0)],
  });

  assert.equal(w.matches, 0);
  assert.equal(w.threshold, 0);
  assert.equal(w.players, 0);
  assert.deepEqual(w.rows, []);
});

test("wejscie nie jest przestawiane w miejscu", async () => {
  // Te same obiekty siedza w pamieci podrecznej rankingu punktowego.
  // Gdyby ta funkcja nadpisala im `rank`, przelaczenie osi zepsuloby
  // tabele punktowa - i to na stale, do nastepnego odswiezenia cache'u.
  const { buildAccuracyRanking } = await import(MODUL);

  const wejscie = [gracz("a", 10, 9, { rank: 7 }), gracz("b", 10, 5, { rank: 2 })];

  buildAccuracyRanking({ matches: 10, players: wejscie });

  assert.equal(wejscie[0].rank, 7, "oryginal nietkniety");
  assert.equal(wejscie[1].rank, 2);
  assert.equal(wejscie[0].points_rank, undefined);
});

test("brak wejscia nie wywraca liczenia", async () => {
  const { buildAccuracyRanking } = await import(MODUL);

  assert.equal(buildAccuracyRanking().players, 0);
  assert.equal(buildAccuracyRanking({}).threshold, 0);
  assert.deepEqual(buildAccuracyRanking({ matches: 10, players: [null] }).rows, []);
});
