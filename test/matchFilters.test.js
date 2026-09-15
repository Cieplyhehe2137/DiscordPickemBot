// Filtrowanie listy meczow (web/src/lib/matchFilters.js).
//
// Testy pilnuja tego, co konczy sie pusta lista wygladajaca na prawdziwa:
// porownania faz wrazliwego na wielkosc liter (API oddaje PLAYIN, adres
// bywa playin) i filtru, ktory przy braku wartosci odsiewa wszystko zamiast
// nic nie odsiewac.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../web/src/lib/matchFilters.js";

function mecz(nadpisania = {}) {
  return {
    id: 1,
    match_no: 1,
    phase: "PLAYIN",
    team_a: "FaZe",
    team_b: "Vitality",
    ui_status: "FINAL",
    predictions_allowed: false,
    ...nadpisania,
  };
}

// --- stan meczu ------------------------------------------------------------

test("stan meczu wynika z pol, ktorych strona uzywa w stopce", async () => {
  const { matchState } = await import(MODUL);

  assert.equal(matchState(mecz({ ui_status: "FINAL" })), "finished");

  assert.equal(
    matchState(mecz({ ui_status: "LOCKED", predictions_allowed: false })),
    "locked",
  );

  assert.equal(
    matchState(mecz({ ui_status: "OPEN", predictions_allowed: true })),
    "open",
  );
});

test("nieznana wartosc ui_status nie wywraca stanu", async () => {
  // W bazie widac dzis tylko FINAL i LOCKED, bo wszystkie turnieje sa
  // zakonczone. Jak nazywa sie stan meczu w trakcie - nie wiadomo, wiec
  // logika nie moze na tej nazwie stac.
  const { matchState } = await import(MODUL);

  assert.equal(
    matchState(mecz({ ui_status: "COS_NOWEGO", predictions_allowed: true })),
    "open",
  );

  assert.equal(
    matchState(mecz({ ui_status: "COS_NOWEGO", predictions_allowed: false })),
    "locked",
  );
});

test("brak meczu nie wywraca sie na undefined", async () => {
  const { matchState } = await import(MODUL);

  assert.equal(matchState(null), "open");
  assert.equal(matchState(undefined), "open");
});

// --- filtr po fazie --------------------------------------------------------

test("faza porownuje sie bez wzgledu na wielkosc liter", async () => {
  // API oddaje "PLAYIN", a adres moze niesc "playin" - to ta sama faza.
  const { filterMatches } = await import(MODUL);

  const lista = [mecz({ id: 1, phase: "PLAYIN" }), mecz({ id: 2, phase: "PLAYOFFS" })];

  assert.equal(filterMatches(lista, { phase: "PLAYIN" }).length, 1);
  assert.equal(filterMatches(lista, { phase: "playin" }).length, 1);
  assert.equal(filterMatches(lista, { phase: "PlayIn" }).length, 1);
});

// --- filtr po druzynie -----------------------------------------------------

test("druzyna lapie sie po obu stronach meczu", async () => {
  const { filterMatches } = await import(MODUL);

  const lista = [
    mecz({ id: 1, team_a: "FaZe", team_b: "Vitality" }),
    mecz({ id: 2, team_a: "MOUZ", team_b: "FaZe" }),
    mecz({ id: 3, team_a: "G2", team_b: "Spirit" }),
  ];

  const wynik = filterMatches(lista, { team: "FaZe" });

  assert.equal(wynik.length, 2);
  assert.deepEqual(
    wynik.map((m) => m.id),
    [1, 2],
  );
});

test("druzyna porownuje sie doslownie", async () => {
  // Lista do wyboru powstaje z TYCH SAMYCH meczow, wiec doslowne porownanie
  // zawsze trafi. Dopisanie tu normalizacji rozjechaloby wybor z filtrem.
  const { filterMatches } = await import(MODUL);

  const lista = [mecz({ team_a: "FUT Esports" })];

  assert.equal(filterMatches(lista, { team: "FUT Esports" }).length, 1);
  assert.equal(filterMatches(lista, { team: "FUT" }).length, 0);
});

// --- filtr po stanie -------------------------------------------------------

test("stan odsiewa tylko mecze w tym stanie", async () => {
  const { filterMatches } = await import(MODUL);

  const lista = [
    mecz({ id: 1, ui_status: "FINAL" }),
    mecz({ id: 2, ui_status: "LOCKED", predictions_allowed: false }),
    mecz({ id: 3, ui_status: "OPEN", predictions_allowed: true }),
  ];

  assert.deepEqual(
    filterMatches(lista, { state: "finished" }).map((m) => m.id),
    [1],
  );

  assert.deepEqual(
    filterMatches(lista, { state: "locked" }).map((m) => m.id),
    [2],
  );

  assert.deepEqual(
    filterMatches(lista, { state: "open" }).map((m) => m.id),
    [3],
  );
});

// --- brak filtrow ----------------------------------------------------------

test("brak filtrow oddaje cala liste", async () => {
  // Najlatwiejszy blad w tej funkcji: pusta wartosc traktowana jak wartosc,
  // przez co adres bez parametrow daje zero meczow i wyglada na awarie danych.
  const { filterMatches } = await import(MODUL);

  const lista = [mecz({ id: 1 }), mecz({ id: 2 })];

  assert.equal(filterMatches(lista, {}).length, 2);
  assert.equal(filterMatches(lista).length, 2);
  assert.equal(filterMatches(lista, { phase: "", team: "", state: "" }).length, 2);
  assert.equal(
    filterMatches(lista, { phase: null, team: null, state: null }).length,
    2,
  );
});

test("filtry skladaja sie ze soba", async () => {
  const { filterMatches } = await import(MODUL);

  const lista = [
    mecz({ id: 1, phase: "PLAYIN", team_a: "FaZe", ui_status: "FINAL" }),
    mecz({ id: 2, phase: "PLAYIN", team_a: "MOUZ", ui_status: "FINAL" }),
    mecz({ id: 3, phase: "PLAYOFFS", team_a: "FaZe", ui_status: "FINAL" }),
  ];

  const wynik = filterMatches(lista, {
    phase: "playin",
    team: "FaZe",
    state: "finished",
  });

  assert.deepEqual(
    wynik.map((m) => m.id),
    [1],
  );
});

test("pusta lista meczow nie wywraca sie", async () => {
  const { filterMatches, teamsFromMatches, phasesFromMatches } = await import(
    MODUL
  );

  assert.deepEqual(filterMatches([], { team: "FaZe" }), []);
  assert.deepEqual(filterMatches(null, {}), []);
  assert.deepEqual(teamsFromMatches(null), []);
  assert.deepEqual(phasesFromMatches(undefined), []);
});

// --- listy do wyboru -------------------------------------------------------

test("lista druzyn jest bez powtorzen i alfabetyczna", async () => {
  const { teamsFromMatches } = await import(MODUL);

  const lista = [
    mecz({ team_a: "Vitality", team_b: "FaZe" }),
    mecz({ team_a: "FaZe", team_b: "MOUZ" }),
    mecz({ team_a: "Aurora", team_b: "Vitality" }),
  ];

  assert.deepEqual(teamsFromMatches(lista), [
    "Aurora",
    "FaZe",
    "MOUZ",
    "Vitality",
  ]);
});

test("puste nazwy druzyn nie trafiaja na liste", async () => {
  // W bazie zdarzaja sie mecze bez nazwy jednej ze stron.
  const { teamsFromMatches } = await import(MODUL);

  const lista = [mecz({ team_a: "FaZe", team_b: null }), mecz({ team_a: "" })];

  assert.deepEqual(teamsFromMatches(lista), ["FaZe", "Vitality"]);
});

test("fazy dostaja czytelne etykiety mimo wielkich liter", async () => {
  // To byl istniejacy blad na tej stronie: naglowek pokazywal surowe
  // "PLAYIN", bo lokalna mapa etykiet miala klucze malymi literami.
  const { phasesFromMatches } = await import(MODUL);

  const lista = [
    mecz({ phase: "PLAYIN" }),
    mecz({ phase: "DOUBLEELIM" }),
    mecz({ phase: "PLAYOFFS" }),
    mecz({ phase: "PLAYIN" }),
  ];

  const fazy = phasesFromMatches(lista);

  assert.equal(fazy.length, 3, "bez powtorzen");

  assert.deepEqual(
    fazy.map((f) => f.label),
    ["Play-In", "Double Elimination", "Playoffs"],
  );
});
