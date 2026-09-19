// Typy na fazy Swiss (server/lib/swissPicks.js).
//
// Zmierzone na produkcji - dwie historie, ktore ta strona ma opowiedziec:
//
//   PEWNIAKI, KTORE NIE WYSZLY      GamerLegion 84% na 3-0
//                                   THUNDER dOWNUNDER 76% na 0-3
//                                   B8 71% na awans
//
//   ODPOWIEDZI, KTORYCH NIKT NIE WIDZIAL   Lynn Vision Gaming 1% na 0-3
//                                          FlyQuest 1% na 3-0
//                                          SINNERS 2% na 0-3
//
// Najmocniej pilnowane jest tu to, ze poprawna odpowiedz NIE MOZE wypasc
// z listy przez przyciecie do czolowki - bo wlasnie o nia chodzi.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/swissPicks.js";

/** N typow o tej samej tresci. */
function typy(ile, wartosci, stage = "stage1") {
  return Array.from({ length: ile }, () => ({
    stage,
    pick_3_0: "",
    pick_0_3: "",
    advancing: "",
    ...wartosci,
  }));
}

function wynik({
  stage = "stage1",
  correct_3_0 = "",
  correct_0_3 = "",
  correct_advancing = "",
} = {}) {
  return { stage, correct_3_0, correct_0_3, correct_advancing };
}

/** Skrot: grupa danego rodzaju z pierwszego etapu. */
function grupa(out, kind, etap = 0) {
  return out.stages[etap].groups.find((g) => g.kind === kind);
}

// --- etapy -------------------------------------------------------------------

test("typy dziela sie na etapy, a etapy ida po kolei", async () => {
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(
    [
      ...typy(3, { advancing: "B8" }, "stage2"),
      ...typy(5, { advancing: "B8" }, "stage1"),
    ],
    [],
  );

  assert.deepEqual(out.stages.map((s) => s.stage), ["stage1", "stage2"]);
  assert.equal(out.stages[0].total, 5);
  assert.equal(out.stages[1].total, 3);
});

test("etap bez wyniku wchodzi na liste, tylko bez rozstrzygniecia", async () => {
  // Sam podzial glosow jest wart pokazania, zanim etap sie rozstrzygnie.
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(typy(4, { advancing: "B8" }), []);

  assert.equal(out.stages[0].settled, false);
  assert.equal(grupa(out, "advancing").teams[0].correct, false);
  assert.equal(grupa(out, "advancing").correct_count, 0);
});

test("turniej bez faz Swiss oddaje pusta liste, a nie blad", async () => {
  const { buildSwissPicks } = await import(MODUL);

  assert.deepEqual(buildSwissPicks([], []).stages, []);
  assert.deepEqual(buildSwissPicks(null, null).stages, []);
});

// --- zliczanie ---------------------------------------------------------------

test("procent liczy sie z typujacych w tym etapie", async () => {
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(
    [...typy(3, { advancing: "B8, Heroic" }), ...typy(1, { advancing: "MIBR" })],
    [],
  );

  const g = grupa(out, "advancing");

  assert.equal(out.stages[0].total, 4);
  assert.equal(g.teams.find((d) => d.name === "B8").count, 3);
  assert.equal(g.teams.find((d) => d.name === "B8").percent, 75);
  assert.equal(g.teams.find((d) => d.name === "MIBR").percent, 25);
});

test("ta sama druzyna dwa razy u jednego gracza liczy sie RAZ", async () => {
  // To jest jedno jego zdanie o tej druzynie, a nie dwa.
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(typy(1, { advancing: "B8, B8, Heroic" }), []);

  assert.equal(grupa(out, "advancing").teams.find((d) => d.name === "B8").count, 1);
});

test("rozne zapisy tej samej nazwy to jedna druzyna", async () => {
  // W bazie stoi wolny tekst: "FaZe Clan" obok "Faze Clan".
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(
    [
      ...typy(6, { advancing: "FaZe Clan" }),
      ...typy(4, { advancing: "Faze Clan" }),
    ],
    [],
  );

  const g = grupa(out, "advancing");

  assert.equal(g.teams.length, 1, "jedna druzyna, nie dwie");
  assert.equal(g.teams[0].count, 10);

  // Pokazywany jest zapis wiekszosci.
  assert.equal(g.teams[0].name, "FaZe Clan");
});

test("trzy grupy licza sie niezaleznie od siebie", async () => {
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(
    typy(2, { pick_3_0: "Spirit", pick_0_3: "TYLOO", advancing: "B8" }),
    [],
  );

  assert.equal(grupa(out, "three_zero").teams[0].name, "Spirit");
  assert.equal(grupa(out, "zero_three").teams[0].name, "TYLOO");
  assert.equal(grupa(out, "advancing").teams[0].name, "B8");
});

// --- poprawne odpowiedzi -----------------------------------------------------

test("poprawna odpowiedz jest oznaczona, takze przy innym zapisie nazwy", async () => {
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(
    [...typy(5, { advancing: "Faze Clan" }), ...typy(5, { advancing: "B8" })],
    [wynik({ correct_advancing: "FaZe Clan" })],
  );

  const g = grupa(out, "advancing");

  assert.equal(g.correct_count, 1);
  assert.equal(g.teams.find((d) => d.name === "Faze Clan").correct, true);
  assert.equal(g.teams.find((d) => d.name === "B8").correct, false);
});

test("POPRAWNA ODPOWIEDZ NIE WYPADA z listy przez przyciecie", async () => {
  // Sedno tej strony. SINNERS mialo 2% i poszlo 0-3 - gdyby lista byla
  // uciecta do czolowki, zniknelby dokladnie ten wiersz, o ktorym warto
  // opowiedziec.
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(
    [
      ...typy(50, { pick_0_3: "A" }),
      ...typy(40, { pick_0_3: "B" }),
      ...typy(30, { pick_0_3: "C" }),
      ...typy(20, { pick_0_3: "D" }),
      ...typy(10, { pick_0_3: "E" }),
      ...typy(5, { pick_0_3: "F" }),
      ...typy(2, { pick_0_3: "SINNERS" }),
    ],
    [wynik({ correct_0_3: "SINNERS" })],
    { topTeams: 5 },
  );

  const g = grupa(out, "zero_three");

  const sinners = g.teams.find((d) => d.name === "SINNERS");

  assert.ok(sinners, "poprawna odpowiedz musi zostac na liscie");
  assert.equal(sinners.correct, true);
  assert.equal(sinners.percent, 1, "2 ze 157");
});

test("przeoczona to poprawna odpowiedz ponizej progu", async () => {
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(
    [
      ...typy(80, { advancing: "Widziana" }),
      ...typy(20, { advancing: "Przeoczona" }),
    ],
    [wynik({ correct_advancing: "Widziana, Przeoczona" })],
    { missedBelow: 30 },
  );

  const g = grupa(out, "advancing");

  assert.equal(g.correct_count, 2);
  assert.equal(g.missed, 1, "20% jest ponizej progu 30%, 80% nie");
});

test("prog przeoczenia wraca w wyniku, zeby strona mogla go napisac", async () => {
  const { buildSwissPicks } = await import(MODUL);

  assert.equal(buildSwissPicks([], []).missed_below, 30);
  assert.equal(buildSwissPicks([], [], { missedBelow: 10 }).missed_below, 10);
});

// --- pewniak, ktory nie wyszedl ----------------------------------------------

test("przereklamowana to najmocniej obstawiona druzyna, ktora NIE trafila", async () => {
  // Zmierzone: GamerLegion 84% na 3-0 i nie poszla.
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(
    [
      ...typy(84, { pick_3_0: "GamerLegion" }),
      ...typy(44, { pick_3_0: "BetBoom" }),
    ],
    [wynik({ correct_3_0: "BetBoom" })],
  );

  const g = grupa(out, "three_zero");

  assert.equal(g.overrated.name, "GamerLegion");
  assert.equal(g.overrated.percent, 66, "84 ze 128");
});

test("gdy tlum trafil w czolowce, przereklamowana jest kolejna", async () => {
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(
    [
      ...typy(90, { pick_3_0: "Spirit" }),
      ...typy(30, { pick_3_0: "Legacy" }),
    ],
    [wynik({ correct_3_0: "Spirit" })],
  );

  assert.equal(grupa(out, "three_zero").overrated.name, "Legacy");
});

test("gdy wszystkie obstawione byly poprawne, nie ma przereklamowanej", async () => {
  const { buildSwissPicks } = await import(MODUL);

  const out = buildSwissPicks(typy(5, { pick_3_0: "Spirit" }), [
    wynik({ correct_3_0: "Spirit" }),
  ]);

  assert.equal(grupa(out, "three_zero").overrated, null);
});

// --- powtarzalnosc -----------------------------------------------------------

test("kolejnosc nie zalezy od kolejnosci wierszy z bazy", async () => {
  const { buildSwissPicks } = await import(MODUL);

  const rows = [
    ...typy(5, { advancing: "Zeta" }),
    ...typy(5, { advancing: "Alfa" }),
    ...typy(3, { advancing: "Beta" }),
  ];

  const a = buildSwissPicks(rows, []);
  const b = buildSwissPicks([...rows].reverse(), []);

  assert.deepEqual(
    grupa(a, "advancing").teams.map((d) => d.name),
    grupa(b, "advancing").teams.map((d) => d.name),
  );

  assert.deepEqual(
    grupa(a, "advancing").teams.map((d) => d.name),
    ["Alfa", "Zeta", "Beta"],
    "przy remisie decyduje nazwa",
  );
});

// --- logotypy ----------------------------------------------------------------

test("logotyp wiaze sie przez klucz druzyny", async () => {
  const { buildSwissPicks } = await import(MODUL);
  const { teamKey } = await import("../server/lib/teamLogos.js");

  const out = buildSwissPicks(typy(1, { advancing: "FaZe Clan" }), [], {
    logos: [{ name_key: teamKey("Faze Clan"), logo_url: "https://x/faze.png" }],
  });

  assert.equal(grupa(out, "advancing").teams[0].logo, "https://x/faze.png");
});
