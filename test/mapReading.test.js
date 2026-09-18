// Czytanie wynikow map (server/lib/mapReading.js).
//
// Zmierzone na produkcji, 18 090 rozliczonych typow od 558 graczy:
// srednia TYPOWANA roznica rund to 4.74, a FAKTYCZNA 5.47. Spolecznosc
// typuje mapy ciasniej, niz one wychodza - i o tym jest cala ta strona.
//
// Nazwy mapy w danych nie ma (match_maps jest pusta), a numer mapy nic nie
// mowi: skutecznosc na mapie 1, 2 i 3 to 54%, 56% i 55%. Dlatego modul nie
// liczy niczego per mapa i te testy tego nie sprawdzaja.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/mapReading.js";

function typ({
  match_id = 1,
  map_no = 1,
  user_id = "gracz",
  pred_exact_a = 13,
  pred_exact_b = 9,
  exact_a = 13,
  exact_b = 9,
} = {}) {
  return { match_id, map_no, user_id, pred_exact_a, pred_exact_b, exact_a, exact_b };
}

// --- srednia roznica rund ----------------------------------------------------

test("srednia roznica liczy sie osobno dla typow i dla wynikow", async () => {
  // To jest sedno tej strony: dwie liczby obok siebie.
  const { buildMapReading } = await import(MODUL);

  const wynik = buildMapReading(
    [
      // Mapa 1: dwoje typowalo ciasno, padlo jednostronnie.
      typ({ match_id: 1, user_id: "a", pred_exact_a: 13, pred_exact_b: 11, exact_a: 13, exact_b: 3 }),
      typ({ match_id: 1, user_id: "b", pred_exact_a: 13, pred_exact_b: 11, exact_a: 13, exact_b: 3 }),
    ],
    [],
    { minPicks: 1 },
  );

  assert.equal(wynik.avg_predicted_gap, 2);
  assert.equal(wynik.avg_actual_gap, 10);
});

test("mapa wchodzi do rozkladu faktycznego RAZ, nie raz na typujacego", async () => {
  // Mapa ze setka typujacych wazylaby sto razy wiecej niz mapa z jednym -
  // a rozklad ma opisywac to, co padlo, nie to, co ogladano.
  const { buildMapReading } = await import(MODUL);

  const typy = [];

  // Mapa 1: piecioro typujacych, wynik 13:3.
  for (const kto of ["a", "b", "c", "d", "e"]) {
    typy.push(typ({ match_id: 1, user_id: kto, exact_a: 13, exact_b: 3 }));
  }

  // Mapa 2: jeden typujacy, wynik 13:11.
  typy.push(typ({ match_id: 2, user_id: "a", exact_a: 13, exact_b: 11 }));

  const wynik = buildMapReading(typy, [], { minPicks: 1 });

  assert.equal(wynik.settled_picks, 6);
  assert.equal(wynik.settled_maps, 2);

  // Gdyby mapy liczyly sie raz na typujacego, srednia wyszlaby 3.3.
  assert.equal(wynik.avg_actual_gap, 6);
});

test("ta sama mapa w dwoch meczach to dwie rozne mapy", async () => {
  const { buildMapReading } = await import(MODUL);

  const wynik = buildMapReading(
    [
      typ({ match_id: 1, map_no: 1, exact_a: 13, exact_b: 0 }),
      typ({ match_id: 2, map_no: 1, exact_a: 13, exact_b: 0 }),
    ],
    [],
    { minPicks: 1 },
  );

  assert.equal(wynik.settled_maps, 2);
});

// --- rozklady ----------------------------------------------------------------

test("wynik sprowadza sie do postaci wyzszy:nizszy", async () => {
  // 13:9 i 9:13 to ten sam przebieg mapy widziany z dwoch stron. Pytanie
  // brzmi "jak jednostronna byla mapa", nie "ktora druzyna wygrala".
  const { buildMapReading } = await import(MODUL);

  const wynik = buildMapReading(
    [
      typ({ match_id: 1, pred_exact_a: 13, pred_exact_b: 9, exact_a: 13, exact_b: 9 }),
      typ({ match_id: 2, user_id: "b", pred_exact_a: 9, pred_exact_b: 13, exact_a: 9, exact_b: 13 }),
    ],
    [],
    { minPicks: 1 },
  );

  assert.equal(wynik.predicted.length, 1, "oba typy to ten sam ksztalt");
  assert.deepEqual(wynik.predicted[0], { high: 13, low: 9, count: 2, share: 100 });
});

test("rozklad idzie od najczestszego wyniku i ma ograniczona dlugosc", async () => {
  const { buildMapReading } = await import(MODUL);

  const typy = [];
  let mecz = 0;

  // Trzy razy 13:9, dwa razy 13:5, raz 13:0.
  for (const [a, b, ile] of [[13, 9, 3], [13, 5, 2], [13, 0, 1]]) {
    for (let i = 0; i < ile; i += 1) {
      mecz += 1;
      typy.push(typ({ match_id: mecz, pred_exact_a: a, pred_exact_b: b }));
    }
  }

  const wynik = buildMapReading(typy, [], { minPicks: 1, topScores: 2 });

  assert.deepEqual(
    wynik.predicted.map((w) => `${w.high}:${w.low} x${w.count}`),
    ["13:9 x3", "13:5 x2"],
  );

  assert.equal(wynik.predicted[0].share, 50);
});

// --- zestawienie graczy ------------------------------------------------------

test("o kolejnosci decyduje ODCHYLENIE, a nie liczba dokladnych trafien", async () => {
  // Odchylenie to dokladnie ta miara, na ktorej stoi punktacja map w tym
  // serwisie: trzeba trafic zwyciezce, a potem liczy sie laczne odchylenie.
  const { buildMapReading } = await import(MODUL);

  const typy = [];

  // Rowny: cztery razy pudlo o dwie rundy lacznie.
  for (let i = 1; i <= 4; i += 1) {
    typy.push(typ({ match_id: i, user_id: "rowny", pred_exact_a: 13, pred_exact_b: 8, exact_a: 13, exact_b: 9 }));
  }

  // Nierowny: raz dokladnie, trzy razy daleko.
  typy.push(typ({ match_id: 5, user_id: "nierowny", pred_exact_a: 13, pred_exact_b: 9, exact_a: 13, exact_b: 9 }));
  for (let i = 6; i <= 8; i += 1) {
    typy.push(typ({ match_id: i, user_id: "nierowny", pred_exact_a: 13, pred_exact_b: 11, exact_a: 13, exact_b: 2 }));
  }

  const wynik = buildMapReading(typy, [], { minPicks: 4 });

  assert.deepEqual(
    wynik.readers.map((g) => g.user_id),
    ["rowny", "nierowny"],
  );

  assert.equal(wynik.readers[0].deviation, 1);
  assert.equal(wynik.readers[0].exact, 0);
  assert.equal(wynik.readers[1].exact, 1, "dokladne trafienie nie wystarcza");
});

test("trafienie zwyciezcy mapy jedzie jako osobna liczba", async () => {
  // W punktacji serwisu to warunek wstepny: bez trafionego zwyciezcy bliski
  // wynik nie daje nic. Dlatego stoi obok odchylenia, a nie zamiast niego.
  const { buildMapReading } = await import(MODUL);

  const typy = [
    typ({ match_id: 1, user_id: "a", pred_exact_a: 13, pred_exact_b: 9, exact_a: 13, exact_b: 9 }),
    typ({ match_id: 2, user_id: "a", pred_exact_a: 13, pred_exact_b: 9, exact_a: 9, exact_b: 13 }),
  ];

  const wynik = buildMapReading(typy, [], { minPicks: 1 });

  assert.equal(wynik.readers[0].winner_rate, 50);
});

test("za malo typow znaczy brak miejsca w zestawieniu", async () => {
  const { buildMapReading } = await import(MODUL);

  const wynik = buildMapReading([typ({ user_id: "jeden" })], [], { minPicks: 30 });

  assert.deepEqual(wynik.readers, []);

  // Ale rozklady i srednie licza sie z WSZYSTKICH typow, nie tylko z tych,
  // ktore przeszly prog.
  assert.equal(wynik.settled_picks, 1);
});

test("nazwa dochodzi z profilu, a pierwsze zrodlo wygrywa", async () => {
  const { buildMapReading } = await import(MODUL);

  const typy = [typ({ user_id: "u1" }), typ({ match_id: 2, user_id: "u1" })];

  const wynik = buildMapReading(
    typy,
    [
      { user_id: "u1", displayname: "Z profilu", avatar: "abc" },
      { user_id: "u1", displayname: "Z fazy" },
    ],
    { minPicks: 1 },
  );

  assert.equal(wynik.readers[0].displayname, "Z profilu");
  assert.equal(wynik.readers[0].avatar, "abc");
});

// --- dane niepelne -----------------------------------------------------------

test("niepelny typ albo niepelny wynik nie wchodzi do sredniej jako zero", async () => {
  // Number(null) to zero, wiec bez sprawdzenia brakujacy wynik wygladalby
  // na 0:0 i psul kazda liczbe na tej stronie.
  const { buildMapReading } = await import(MODUL);

  const wynik = buildMapReading(
    [
      typ({ match_id: 1, pred_exact_a: 13, pred_exact_b: 9, exact_a: 13, exact_b: 9 }),
      typ({ match_id: 2, user_id: "b", exact_a: null, exact_b: null }),
      typ({ match_id: 3, user_id: "c", pred_exact_a: null, pred_exact_b: null }),
    ],
    [],
    { minPicks: 1 },
  );

  assert.equal(wynik.settled_picks, 1);
  assert.equal(wynik.settled_maps, 1);
  assert.equal(wynik.players, 1);
});

test("brak danych daje puste liczby, a nie wyjatek", async () => {
  const { buildMapReading } = await import(MODUL);

  const wynik = buildMapReading([], [], { minPicks: 1 });

  assert.equal(wynik.settled_picks, 0);
  assert.equal(wynik.avg_predicted_gap, null);
  assert.equal(wynik.avg_actual_gap, null);
  assert.deepEqual(wynik.predicted, []);
  assert.deepEqual(wynik.readers, []);

  assert.equal(buildMapReading(null, null).settled_picks, 0);
});
