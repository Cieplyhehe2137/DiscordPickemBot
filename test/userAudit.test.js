// Audyt gracza dla panelu administratora (server/lib/userAudit.js).
//
// Po co osobno od profilu: profil tnie historie do DZIESIECIU ostatnich
// meczow, a czolowy gracz Kolonii ma ich 106 - widac 9% jego wyborow.
//
// Sprawdzone na produkcji: audyt pieki daje 106 typow, 73 trafienia, 69%
// i 268 punktow - dokladnie te same liczby, ktore oddaje publiczny profil.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/userAudit.js";

function mecz(n, { best_of = 1, ...reszta } = {}) {
  return { id: n, match_no: n, phase: "SWISS_STAGE1", team_a: "A", team_b: "B", best_of, ...reszta };
}

test("sklada typ, wynik i punkty w jeden wiersz", async () => {
  const { buildUserAudit } = await import(MODUL);

  const { rows } = buildUserAudit({
    matches: [mecz(1)],
    predictions: [{ match_id: 1, pred_a: 1, pred_b: 0 }],
    results: [{ match_id: 1, res_a: 1, res_b: 0 }],
    points: [{ match_id: 1, source: "series", points: 2 }],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].picked, true);
  assert.equal(rows[0].settled, true);
  assert.equal(rows[0].correct_winner, true);
  assert.equal(rows[0].points, 2);
});

test("punkty sumuja sie PO ZRODLACH, bo match_points ma wiersz na kazde", async () => {
  // Pominiecie tego pokazywaloby w audycie polowe dorobku i wygladaloby
  // na blad w naliczaniu. Zmierzone: tabela ma 20 395 wierszy przy
  // 10 328 typach, bo kazdy mecz ma osobno 'series' i 'map'.
  const { buildUserAudit } = await import(MODUL);

  const { rows, summary } = buildUserAudit({
    matches: [mecz(1, { best_of: 3 })],
    predictions: [{ match_id: 1, pred_a: 2, pred_b: 0 }],
    results: [{ match_id: 1, res_a: 2, res_b: 0 }],
    points: [
      { match_id: 1, source: "series", points: 2 },
      { match_id: 1, source: "map", points: 5 },
    ],
  });

  assert.equal(rows[0].points, 7);
  assert.equal(rows[0].series_points, 2);
  assert.equal(rows[0].map_points, 5);
  assert.equal(summary.points, 7);
});

test("mecz BEZ TYPU zostaje w audycie jako mecz bez typu", async () => {
  // To jest najczestsze pytanie audytu: "czy on to w ogole obstawil".
  // Pominiecie takiego meczu odpowiadaloby na nie przemilczeniem.
  const { buildUserAudit } = await import(MODUL);

  const { rows, summary } = buildUserAudit({
    matches: [mecz(1), mecz(2)],
    predictions: [{ match_id: 1, pred_a: 1, pred_b: 0 }],
    results: [{ match_id: 1, res_a: 1, res_b: 0 }, { match_id: 2, res_a: 0, res_b: 1 }],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[1].picked, false);
  assert.equal(rows[1].pred_a, null);
  assert.equal(rows[1].correct_winner, null, "brak typu to nie jest pudlo");

  assert.equal(summary.matches, 2);
  assert.equal(summary.picked, 1);
});

test("mecz bez wyniku nie liczy sie do skutecznosci", async () => {
  const { buildUserAudit } = await import(MODUL);

  const { summary } = buildUserAudit({
    matches: [mecz(1), mecz(2)],
    predictions: [
      { match_id: 1, pred_a: 1, pred_b: 0 },
      { match_id: 2, pred_a: 1, pred_b: 0 },
    ],
    results: [{ match_id: 1, res_a: 1, res_b: 0 }],
  });

  assert.equal(summary.picked, 2);
  assert.equal(summary.settled, 1);
  assert.equal(summary.accuracy, 100, "jeden z jednego rozstrzygnietego");
});

test("brak rozstrzygnietych daje null, a nie zero procent", async () => {
  const { buildUserAudit } = await import(MODUL);

  const { summary } = buildUserAudit({
    matches: [mecz(1)],
    predictions: [{ match_id: 1, pred_a: 1, pred_b: 0 }],
  });

  assert.equal(summary.accuracy, null);
});

test("mapa nierozegrana pokazuje sam typ, a nie pudlo", async () => {
  // Gracz wpisuje typ na trzecia mape, a mecz konczy sie po dwoch. To nie
  // jest jego blad i audyt nie moze tego tak przedstawiac. Zmierzone na
  // produkcji: tak wyglada wiekszosc BO3 w bazie.
  const { buildUserAudit } = await import(MODUL);

  const { rows } = buildUserAudit({
    matches: [mecz(1, { best_of: 3 })],
    predictions: [{ match_id: 1, pred_a: 2, pred_b: 1 }],
    results: [{ match_id: 1, res_a: 2, res_b: 0 }],
    mapPicks: [
      { match_id: 1, map_no: 1, pred_exact_a: 13, pred_exact_b: 10 },
      { match_id: 1, map_no: 3, pred_exact_a: 13, pred_exact_b: 9 },
    ],
    mapResults: [{ match_id: 1, map_no: 1, exact_a: 13, exact_b: 11 }],
  });

  const [m1, m3] = rows[0].maps;

  assert.equal(m1.correct_winner, true);
  assert.equal(m1.exact, false, "13:10 przy 13:11 to trafiony zwyciezca, nie dokladny wynik");

  assert.equal(m3.res_a, null);
  assert.equal(m3.correct_winner, null, "nierozegrana mapa to nie pudlo");
  assert.equal(m3.exact, null);
});

test("mapa rozegrana, ale nietypowana, tez jest w audycie", async () => {
  // Drugie pytanie audytu: czego NIE wpisal.
  const { buildUserAudit } = await import(MODUL);

  const { rows } = buildUserAudit({
    matches: [mecz(1, { best_of: 3 })],
    predictions: [{ match_id: 1, pred_a: 2, pred_b: 1 }],
    mapPicks: [{ match_id: 1, map_no: 1, pred_exact_a: 13, pred_exact_b: 10 }],
    mapResults: [
      { match_id: 1, map_no: 1, exact_a: 13, exact_b: 10 },
      { match_id: 1, map_no: 2, exact_a: 13, exact_b: 4 },
    ],
  });

  assert.deepEqual(rows[0].maps.map((m) => m.map_no), [1, 2]);
  assert.equal(rows[0].maps[1].pred_a, null);
  assert.equal(rows[0].maps[0].exact, true);
});

test("kolejnosc wierszy idzie za meczami, nie za typami", async () => {
  // Typy wracaja z bazy w dowolnej kolejnosci. Audyt ma sie czytac jak
  // przebieg turnieju.
  const { buildUserAudit } = await import(MODUL);

  const { rows } = buildUserAudit({
    matches: [mecz(1), mecz(2), mecz(3)],
    predictions: [
      { match_id: 3, pred_a: 1, pred_b: 0 },
      { match_id: 1, pred_a: 0, pred_b: 1 },
    ],
  });

  assert.deepEqual(rows.map((r) => r.match_id), [1, 2, 3]);
});

test("remis w typie nie jest ani trafieniem, ani pudlem", async () => {
  const { buildUserAudit } = await import(MODUL);

  const { rows } = buildUserAudit({
    matches: [mecz(1)],
    predictions: [{ match_id: 1, pred_a: 1, pred_b: 1 }],
    results: [{ match_id: 1, res_a: 1, res_b: 0 }],
  });

  assert.equal(rows[0].correct_winner, null);
});

test("turniej bez meczow daje pusty audyt, a nie wywrotke", async () => {
  // StarLadder Budapest 2025 nie ma w bazie ani jednego meczu, a ma 509
  // sklasyfikowanych graczy.
  const { buildUserAudit } = await import(MODUL);

  const w = buildUserAudit({ matches: [], predictions: [], results: [] });

  assert.deepEqual(w.rows, []);
  assert.equal(w.summary.matches, 0);
  assert.equal(w.summary.accuracy, null);
  assert.equal(w.summary.points, 0);
});

test("brak wejscia w ogole nie wywraca liczenia", async () => {
  const { buildUserAudit } = await import(MODUL);

  assert.equal(buildUserAudit().rows.length, 0);
  assert.equal(buildUserAudit({}).summary.points, 0);
});
