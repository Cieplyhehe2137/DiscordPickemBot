// Pojedynek dwoch graczy (server/lib/headToHead.js).
//
// Testy pilnuja tego, co przy prawdziwych danych konczy sie zmyslona
// przewaga: meczu bez wyniku policzonego jako remis 0:0, meczu obstawionego
// przez jedna strone doliczonego do sumy i punktow czytanych z NULL-a.

const test = require("node:test");
const assert = require("node:assert/strict");

const H2H = "../server/lib/headToHead.js";

// Wiersz taki, jaki oddaje zapytanie - z domyslnymi wartosciami, zeby test
// wypisywal tylko to, co w nim istotne.
function wiersz(nadpisania = {}) {
  return {
    match_id: 1,
    team_a: "FaZe",
    team_b: "Vitality",
    best_of: 3,
    res_a: 2,
    res_b: 1,
    a_pred_a: 2,
    a_pred_b: 1,
    b_pred_a: 1,
    b_pred_b: 2,
    a_points: 5,
    b_points: 0,
    ...nadpisania,
  };
}

test("wygrywa ten, kto wzial wiecej punktow za mecz", async () => {
  const { matchWinner } = await import(H2H);

  assert.equal(matchWinner(5, 0), "a");
  assert.equal(matchWinner(0, 5), "b");
  assert.equal(matchWinner(3, 3), "tie");
});

test("obaj bez punktow to remis, a nie wygrana pierwszego", async () => {
  const { matchWinner } = await import(H2H);

  assert.equal(matchWinner(0, 0), "tie");
});

test("decyduja punkty, nie sam trafiony zwyciezca", async () => {
  // Obaj wskazali FaZe, ale tylko jeden trafil dokladny wynik serii.
  const { buildDuel } = await import(H2H);

  const { matches, summary } = buildDuel([
    wiersz({
      a_pred_a: 2,
      a_pred_b: 1,
      b_pred_a: 2,
      b_pred_b: 0,
      a_points: 5,
      b_points: 2,
    }),
  ]);

  assert.equal(matches[0].a.correct, true);
  assert.equal(matches[0].b.correct, true);
  assert.equal(matches[0].winner, "a");
  assert.equal(summary.wins_a, 1);
});

test("mecz bez wyniku nie jest remisem - nie liczy sie wcale", async () => {
  // Number(null) to ZERO, nie NaN. Bez jawnego sprawdzenia mecz jeszcze
  // nierozegrany wygladalby na zakonczony wynikiem 0:0 i wpadal do remisow.
  const { buildDuel } = await import(H2H);

  const { matches, summary } = buildDuel([
    wiersz({ res_a: null, res_b: null, a_points: 0, b_points: 0 }),
  ]);

  assert.equal(matches[0].settled, false);
  assert.equal(matches[0].winner, null);

  assert.equal(summary.settled, 0);
  assert.equal(summary.pending, 1);
  assert.equal(summary.ties, 0);
});

test("polowa wyniku to wciaz brak wyniku", async () => {
  const { buildDuel } = await import(H2H);

  const { matches } = buildDuel([wiersz({ res_a: 2, res_b: null })]);

  assert.equal(matches[0].settled, false);
  assert.equal(matches[0].winner, null);
});

test("punkty z NULL-a to zero, nie NaN", async () => {
  // LEFT JOIN oddaje NULL, gdy gracz nie ma wiersza w match_points.
  const { buildDuel } = await import(H2H);

  const { matches, summary } = buildDuel([
    wiersz({ a_points: 4, b_points: null }),
  ]);

  assert.equal(matches[0].b.points, 0);
  assert.equal(summary.points_b, 0);
  assert.equal(summary.wins_a, 1);
});

test("suma punktow liczy sie tylko z meczow rozstrzygnietych", async () => {
  const { buildDuel } = await import(H2H);

  const { summary } = buildDuel([
    wiersz({ match_id: 1, a_points: 5, b_points: 2 }),
    wiersz({ match_id: 2, res_a: null, res_b: null, a_points: 99, b_points: 99 }),
  ]);

  assert.equal(summary.common, 2);
  assert.equal(summary.settled, 1);
  assert.equal(summary.points_a, 5);
  assert.equal(summary.points_b, 2);
});

test("identyczny typ obu stron jest oznaczony", async () => {
  const { buildDuel } = await import(H2H);

  const { matches, summary } = buildDuel([
    wiersz({ a_pred_a: 2, a_pred_b: 1, b_pred_a: 2, b_pred_b: 1, b_points: 5 }),
  ]);

  assert.equal(matches[0].same_pick, true);
  assert.equal(matches[0].winner, "tie");
  assert.equal(summary.same_picks, 1);
});

test("rozny typ nie jest oznaczony jako identyczny", async () => {
  const { buildDuel } = await import(H2H);

  const { matches } = buildDuel([wiersz()]);

  assert.equal(matches[0].same_pick, false);
});

test("pusta lista daje pojedynek bez meczow, a nie blad", async () => {
  // Dwoje ludzi moze nie miec ani jednego wspolnego meczu - strona ma wtedy
  // pokazac pustke, a nie komunikat o awarii.
  const { buildDuel } = await import(H2H);

  const { matches, summary } = buildDuel([]);

  assert.deepEqual(matches, []);
  assert.equal(summary.common, 0);
  assert.equal(summary.settled, 0);
  assert.equal(summary.points_a, 0);
});

test("brak wierszy w ogole nie wywraca sie na undefined", async () => {
  const { buildDuel } = await import(H2H);

  const { summary } = buildDuel(undefined);

  assert.equal(summary.common, 0);
});

test("zlicza wygrane obu stron i remisy osobno", async () => {
  const { buildDuel } = await import(H2H);

  const { summary } = buildDuel([
    wiersz({ match_id: 1, a_points: 5, b_points: 0 }),
    wiersz({ match_id: 2, a_points: 0, b_points: 5 }),
    wiersz({ match_id: 3, a_points: 0, b_points: 5 }),
    wiersz({ match_id: 4, a_points: 2, b_points: 2 }),
  ]);

  assert.equal(summary.settled, 4);
  assert.equal(summary.wins_a, 1);
  assert.equal(summary.wins_b, 2);
  assert.equal(summary.ties, 1);
  assert.equal(summary.points_a, 7);
  assert.equal(summary.points_b, 12);
});
