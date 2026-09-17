// Typy druzyn gracza w fazach turnieju (server/lib/teamPicks.js).
//
// Listy druzyn leza w bazie jako tekst - "B8, BetBoom" - i to samo pole raz
// bywa CSV, raz tablica JSON, zaleznie od tego, ktora wersja bota je zapisala.
// Do tego wynik fazy potrafi miec myslnik zamiast danych: prawdziwy wiersz
// z produkcji ma correct_third_place_winner = "—", bo ten turniej nie mial
// meczu o trzecie miejsce.
//
// Testy pilnuja tego, co przy takich danych konczy sie kafelkiem z myslnikiem
// udajacym nazwe druzyny albo pustym naglowkiem kategorii.

const test = require("node:test");
const assert = require("node:assert/strict");

const TEAM_PICKS = "../server/lib/teamPicks.js";

test("rozbija liste zapisana po przecinku", async () => {
  const { splitTeamList } = await import(TEAM_PICKS);

  assert.deepEqual(splitTeamList("B8, BetBoom"), ["B8", "BetBoom"]);
});

test("rozbija liste zapisana jako tablica JSON", async () => {
  const { splitTeamList } = await import(TEAM_PICKS);

  assert.deepEqual(splitTeamList('["FURIA","Falcons"]'), ["FURIA", "Falcons"]);
});

test("myslnik to brak danych, nie nazwa druzyny", async () => {
  // Prawdziwy wiersz z produkcji: turniej bez meczu o trzecie miejsce.
  const { splitTeamList } = await import(TEAM_PICKS);

  assert.deepEqual(splitTeamList("—"), []);
  assert.deepEqual(splitTeamList("-"), []);
  assert.deepEqual(splitTeamList(" – "), []);
});

test("puste i brakujace wartosci daja pusta liste", async () => {
  const { splitTeamList } = await import(TEAM_PICKS);

  assert.deepEqual(splitTeamList(null), []);
  assert.deepEqual(splitTeamList(""), []);
  assert.deepEqual(splitTeamList(",,, ,"), []);
});

test("nadmiarowe spacje i srednik tez sie licza", async () => {
  const { splitTeamList } = await import(TEAM_PICKS);

  assert.deepEqual(splitTeamList("  MOUZ ;  G2 ,Vitality "), [
    "MOUZ",
    "G2",
    "Vitality",
  ]);
});

test("buduje trzy kategorie Swiss z typem i wynikiem", async () => {
  const { buildGroups } = await import(TEAM_PICKS);

  const grupy = buildGroups(
    "swiss",
    {
      pick_3_0: "B8, BetBoom",
      pick_0_3: "THUNDER dOWNUNDER, Gaimin Gladiators",
      advancing: "GamerLegion, BIG",
    },
    {
      correct_3_0: "B8, BetBoom",
      correct_0_3: "Gaimin Gladiators, SINNERS",
      correct_advancing: "GamerLegion, MIBR",
    },
  );

  assert.deepEqual(
    grupy.map((g) => g.key),
    ["three_zero", "zero_three", "advancing"],
  );

  assert.deepEqual(grupy[0].picked, ["B8", "BetBoom"]);
  assert.deepEqual(grupy[0].correct, ["B8", "BetBoom"]);
  // Etykieta jest KLUCZEM slownika, bo serwer nie wie, w jakim jezyku
  // oglada strone ten, kto pyta. Sprawdzamy przez prawdziwy tlumacz:
  // z atrapa test przeszedlby takze wtedy, gdyby klucza nie bylo
  // w slowniku i na profilu stalo "phaseResults.advancing".
  const { createTranslator, SLOWNIKI } = await import(
    "../web/src/i18n/index.js"
  );

  const t = createTranslator("pl", SLOWNIKI);

  assert.equal(
    t(grupy[2].label),
    "Awansujące",
    "etykieta jak na stronie fazy",
  );
});

test("kategoria bez ani jednego typu wypada z listy", async () => {
  // Pusty naglowek "Finalisci" bez niczego pod spodem wyglada jak awaria,
  // a nie jak informacja, ze ktos tego nie obstawial.
  const { buildGroups } = await import(TEAM_PICKS);

  const grupy = buildGroups(
    "playoffs",
    {
      semifinalists: "FURIA, Aurora",
      finalists: "",
      winner: "Falcons",
      third_place_winner: null,
    },
    null,
  );

  assert.deepEqual(
    grupy.map((g) => g.key),
    ["semifinalists", "winner"],
  );
});

test("faza bez opublikowanego wyniku nadal pokazuje typy", async () => {
  // Wynik moze przyjsc pozniej niz typ. Brak wyniku ma znaczyc "jeszcze nie
  // wiadomo", a nie "wszystko nietrafione".
  const { buildGroups } = await import(TEAM_PICKS);

  const grupy = buildGroups("swiss", { pick_3_0: "B8", advancing: "BIG" }, null);

  assert.equal(grupy.length, 2);

  for (const g of grupy) {
    assert.deepEqual(g.correct, [], "brak wyniku to pusta lista poprawnych");
    assert.ok(g.picked.length > 0);
  }
});

test("brak typu w ogole daje pusta liste grup", async () => {
  const { buildGroups } = await import(TEAM_PICKS);

  assert.deepEqual(buildGroups("swiss", null, { correct_3_0: "B8" }), []);
});

test("nieznany rodzaj fazy nie wywraca sie", async () => {
  const { buildGroups } = await import(TEAM_PICKS);

  assert.deepEqual(buildGroups("cos-nowego", { pick_3_0: "B8" }, null), []);
});

test("pojedyncza nazwa zwyciezcy tez jest lista", async () => {
  // Zwyciezca i trzecie miejsce to w bazie pojedyncze wartosci, ale widok
  // renderuje wszystkie kategorie tak samo.
  const { buildGroups } = await import(TEAM_PICKS);

  const grupy = buildGroups(
    "playoffs",
    { winner: "Falcons" },
    { correct_winner: "Falcons" },
  );

  assert.deepEqual(grupy[0].picked, ["Falcons"]);
  assert.deepEqual(grupy[0].correct, ["Falcons"]);
});

test("kazdy etap Swiss ma swoj rodzaj tabel", async () => {
  const { PHASE_KINDS } = await import(TEAM_PICKS);

  assert.equal(PHASE_KINDS.stage1, "swiss");
  assert.equal(PHASE_KINDS.stage3, "swiss");
  assert.equal(PHASE_KINDS.playoffs, "playoffs");
  assert.equal(PHASE_KINDS.doubleelim, "doubleelim");
});
