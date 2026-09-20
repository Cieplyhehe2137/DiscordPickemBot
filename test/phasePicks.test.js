// Typy gracza na fazy w audycie panelu (server/lib/phasePicks.js).
//
// Po co osobno od typow meczowych: klasyfikacja turnieju to suma szesciu
// skladowych, a piec z nich to fazy. Zmierzone: 634 wpisy gracz-turniej
// nie maja ANI JEDNEGO typu meczowego - dla nich audyt bez faz jest pusty.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/phasePicks.js";

test("sklada typ i oficjalna odpowiedz w jedna grupe", async () => {
  const { buildPhasePicks } = await import(MODUL);

  const { phases } = buildPhasePicks({
    picks: [
      { phase: "swiss", stage: "stage1", kind: "three_zero", teams: "B8, GamerLegion" },
    ],
    results: [
      { phase: "swiss", stage: "stage1", kind: "three_zero", teams: "B8, BetBoom" },
    ],
    scores: [{ phase: "swiss", stage: "stage1", points: 4 }],
  });

  assert.equal(phases.length, 1);
  assert.equal(phases[0].key, "swiss:stage1");
  assert.equal(phases[0].points, 4);

  assert.deepEqual(phases[0].groups[0].picked, [
    { name: "B8", hit: true },
    { name: "GamerLegion", hit: false },
  ]);

  assert.deepEqual(phases[0].groups[0].answer, ["B8", "BetBoom"]);
});

test("trafienie liczone ZNAK W ZNAK, tak jak liczy je bot", async () => {
  // calculateScores porownuje zwykle napisy, wiec "Parivision" przy wyniku
  // "PARIVISION" punktu NIE dostaje. Zestawianie przez teamKey pokazywaloby
  // w audycie trafienie tam, gdzie punktu nie bylo - czyli klamaloby akurat
  // w tej jednej rzeczy, po ktora audyt sie otwiera.
  const { buildPhasePicks } = await import(MODUL);

  const { phases } = buildPhasePicks({
    picks: [{ phase: "playin", kind: "teams", teams: "Parivision, G2" }],
    results: [{ phase: "playin", kind: "teams", teams: "PARIVISION, G2" }],
  });

  const [parivision, g2] = phases[0].groups[0].picked;

  assert.equal(parivision.hit, false, "inna pisownia to brak punktu");
  assert.equal(g2.hit, true);
});

test("grupa bez oficjalnej odpowiedzi nie robi z typu pudla", async () => {
  // W Kolonii playoffs maja wynik, ale pole "3. miejsce" jest w nim puste.
  // Typ na ten jeden mecz jest wtedy pytaniem bez odpowiedzi, nie bledem
  // gracza - a audyt nie moze przedstawiac tego jako zarzutu.
  const { buildPhasePicks } = await import(MODUL);

  const { phases } = buildPhasePicks({
    picks: [
      { phase: "playoffs", kind: "finalists", teams: "Spirit, FURIA" },
      { phase: "playoffs", kind: "third_place", teams: "NAVI" },
    ],
    results: [
      { phase: "playoffs", kind: "finalists", teams: "FURIA, Falcons" },
      { phase: "playoffs", kind: "third_place", teams: null },
    ],
  });

  const grupy = new Map(phases[0].groups.map((g) => [g.kind, g]));

  assert.equal(grupy.get("finalists").picked[0].hit, false);
  assert.equal(grupy.get("finalists").picked[1].hit, true);

  assert.equal(grupy.get("third_place").picked[0].hit, null);
  assert.equal(phases[0].settled_picks, 2, "typ bez odpowiedzi nie wchodzi do rozliczenia");
  assert.equal(phases[0].picks, 3);
});

test("faza WYTYPOWANA PRZEZ NIKOGO zostaje w audycie", async () => {
  // Drugie pytanie audytu: czego NIE wypelnil. Sam wynik fazy wystarczy,
  // zeby ja pokazac - tak samo jak mecz bez typu w userAudit.js.
  const { buildPhasePicks } = await import(MODUL);

  const { phases } = buildPhasePicks({
    results: [
      { phase: "swiss", stage: "stage2", kind: "advancing", teams: "G2, B8" },
    ],
  });

  assert.equal(phases.length, 1);
  assert.equal(phases[0].picked, false);
  assert.equal(phases[0].settled, true);
  assert.equal(phases[0].picks, 0);
  assert.deepEqual(phases[0].groups[0].answer, ["G2", "B8"]);
});

test("grupa pusta z obu stron nie zajmuje wiersza", async () => {
  // Wynik fazy potrafi miec niewypelnione pole: w Budapeszcie playoffs maja
  // wynik, ale bez meczu o 3. miejsce. Wiersz "3. miejsce: — / —" nie mowi
  // nic, a stoi w audycie kazdego gracza tego turnieju.
  const { buildPhasePicks } = await import(MODUL);

  const { phases } = buildPhasePicks({
    picks: [{ phase: "playoffs", kind: "winner", teams: "Spirit" }],
    results: [
      { phase: "playoffs", kind: "winner", teams: "Vitality" },
      { phase: "playoffs", kind: "third_place", teams: null },
    ],
  });

  assert.deepEqual(phases[0].groups.map((g) => g.kind), ["winner"]);
});

test("kolejnosc idzie za przebiegiem turnieju, nie za alfabetem", async () => {
  const { buildPhasePicks } = await import(MODUL);

  const { phases } = buildPhasePicks({
    picks: [
      { phase: "mvp", kind: "mvp", teams: "donk" },
      { phase: "playoffs", kind: "winner", teams: "Spirit" },
      { phase: "swiss", stage: "stage3", kind: "advancing", teams: "NAVI" },
      { phase: "swiss", stage: "stage1", kind: "advancing", teams: "BIG" },
      { phase: "playin", kind: "teams", teams: "Aurora" },
      { phase: "doubleelim", kind: "upper_final_a", teams: "G2" },
    ],
  });

  assert.deepEqual(phases.map((f) => f.key), [
    "playin",
    "swiss:stage1",
    "swiss:stage3",
    "doubleelim",
    "playoffs",
    "mvp",
  ]);
});

test("grupy stoja w kolejnosci formularza, nie w kolejnosci z bazy", async () => {
  const { buildPhasePicks } = await import(MODUL);

  const { phases } = buildPhasePicks({
    picks: [
      { phase: "swiss", stage: "stage1", kind: "advancing", teams: "BIG" },
      { phase: "swiss", stage: "stage1", kind: "three_zero", teams: "B8" },
      { phase: "swiss", stage: "stage1", kind: "zero_three", teams: "MIBR" },
    ],
  });

  assert.deepEqual(phases[0].groups.map((g) => g.kind), [
    "three_zero",
    "zero_three",
    "advancing",
  ]);
});

test("puste pole nie tworzy pustego typu", async () => {
  // W bazie stoi "" u kazdego, kto nie wypelnil trzeciego miejsca - bez
  // tego audyt pokazywalby im typ na nikogo.
  const { buildPhasePicks } = await import(MODUL);

  const { phases } = buildPhasePicks({
    picks: [
      { phase: "playoffs", kind: "winner", teams: "Spirit" },
      { phase: "playoffs", kind: "third_place", teams: "" },
    ],
  });

  assert.deepEqual(phases[0].groups.map((g) => g.kind), ["winner"]);
  assert.equal(phases[0].picks, 1);
});

test("punkty przychodza z tabel wynikow, a nie z liczenia trafien", async () => {
  // W playoffach Kolonii 31 z 99 graczy ma zapisane o 2 punkty wiecej, niz
  // dalaby dzisiejsza regula - slad po bledzie z trzecim miejscem. Audyt ma
  // pokazac to, co widzi klasyfikacja, a nie wlasna wersje.
  const { buildPhasePicks } = await import(MODUL);

  const { phases, summary } = buildPhasePicks({
    picks: [{ phase: "playoffs", kind: "finalists", teams: "Spirit, FURIA" }],
    results: [{ phase: "playoffs", kind: "finalists", teams: "Spirit, FURIA" }],
    scores: [{ phase: "playoffs", points: 8 }],
  });

  assert.equal(phases[0].hits, 2);
  assert.equal(phases[0].points, 8, "osiem z bazy, a nie cztery z przemnozenia");
  assert.equal(summary.points, 8);
});

test("etapy Swiss sumuja sie w podsumowaniu, ale nie w sekcji", async () => {
  const { buildPhasePicks } = await import(MODUL);

  const { phases, summary } = buildPhasePicks({
    scores: [
      { phase: "swiss", stage: "stage1", points: 14 },
      { phase: "swiss", stage: "stage2", points: 14 },
      { phase: "swiss", stage: "stage3", points: 12 },
    ],
  });

  assert.deepEqual(phases.map((f) => f.points), [14, 14, 12]);
  assert.equal(summary.points, 40);
});

test("brak punktow to null, a nie zero", async () => {
  const { buildPhasePicks } = await import(MODUL);

  const { phases, summary } = buildPhasePicks({
    picks: [{ phase: "playin", kind: "teams", teams: "Aurora" }],
  });

  assert.equal(phases[0].points, null, "faza jeszcze nierozliczona");
  assert.equal(summary.points, null);
});

test("nieznana faza nie tworzy sekcji", async () => {
  // Zapytanie moze kiedys dolozyc tabele, ktorej ten modul nie zna. Lepsza
  // jest sekcja mniej niz sekcja bez podpisow i bez kolejnosci.
  const { buildPhasePicks } = await import(MODUL);

  const { phases } = buildPhasePicks({
    picks: [{ phase: "groupstage", kind: "teams", teams: "G2" }],
  });

  assert.deepEqual(phases, []);
});

test("typ zapisany jako tablica JSON czyta sie tak samo jak CSV", async () => {
  const { splitTeams } = await import(MODUL);

  assert.deepEqual(splitTeams('["G2", "B8"]'), ["G2", "B8"]);
  assert.deepEqual(splitTeams("G2, B8"), ["G2", "B8"]);
  assert.deepEqual(splitTeams("G2; B8"), ["G2", "B8"]);
  assert.deepEqual(splitTeams(""), []);
  assert.deepEqual(splitTeams(null), []);
});

test("brak wejscia w ogole nie wywraca liczenia", async () => {
  const { buildPhasePicks } = await import(MODUL);

  assert.deepEqual(buildPhasePicks().phases, []);
  assert.equal(buildPhasePicks({}).summary.points, null);
  assert.equal(buildPhasePicks({}).summary.picks, 0);
});
