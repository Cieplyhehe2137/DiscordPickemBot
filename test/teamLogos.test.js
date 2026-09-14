// Dopasowywanie nazw druzyn do logotypow (server/lib/teamLogos.js).
//
// Sprawdzone na zywym API PandaScore dla wszystkich 48 nazw z bazy: 37 trafia
// doslownie, 7 po aliasie, 4 trzeba uzupelnic recznie. Te testy pilnuja dwoch
// rzeczy, ktore przy takim dopasowywaniu koncza sie cudzym logo na profilu:
// normalizacji zapisu i tego, ze NIE zgadujemy po podobienstwie.

const test = require("node:test");
const assert = require("node:assert/strict");

const LOGOS = "../server/lib/teamLogos.js";

test("normalizacja skleja rozne zapisy tej samej nazwy", async () => {
  const { normalizeTeamName } = await import(LOGOS);

  assert.equal(normalizeTeamName("FaZe Clan"), "fazeclan");
  assert.equal(normalizeTeamName("faze clan"), "fazeclan");
  assert.equal(normalizeTeamName("BC.Game"), "bcgame");
  assert.equal(normalizeTeamName("THUNDER dOWNUNDER"), "thunderdownunder");
  assert.equal(
    normalizeTeamName("PARIVISION"),
    normalizeTeamName("Parivision"),
    "ta sama druzyna zapisana dwoma sposobami",
  );
});

test("pusta nazwa daje pusty klucz, a nie wywrotke", async () => {
  const { normalizeTeamName } = await import(LOGOS);

  assert.equal(normalizeTeamName(null), "");
  assert.equal(normalizeTeamName("  "), "");
});

test("dluzszy zapis nazwy idzie do wyszukiwarki jako krotszy", async () => {
  // Sprawdzone: wyszukanie "Team Liquid" nie zwraca NIC, "Liquid" trafia.
  const { searchNameFor } = await import(LOGOS);

  assert.equal(searchNameFor("Team Liquid"), "Liquid");
  assert.equal(searchNameFor("FaZe Clan"), "FaZe");
  assert.equal(searchNameFor("Lynn Vision Gaming"), "Lynn Vision");
});

test("NAVI idzie jako Natus Vincere, a nie jako juniorzy", async () => {
  // Wyszukiwarka oddaje dla "NAVI" wylacznie ex-NAVI Junior, NAVI Javelins
  // i NAVI Youth. Bez tego aliasu pierwsza druzyna dostalaby logo akademii.
  const { searchNameFor } = await import(LOGOS);

  assert.equal(searchNameFor("NAVI"), "Natus Vincere");
  assert.equal(searchNameFor("navi"), "Natus Vincere");
});

test("nazwa bez aliasu zostaje sobą", async () => {
  const { searchNameFor } = await import(LOGOS);

  assert.equal(searchNameFor("Spirit"), "Spirit");
});

test("bierze wylacznie DOKLADNE trafienie", async () => {
  // To jest sedno. Wyszukanie "Ninjas in Pyjamas" oddaje "Ninjas in Pyjamas
  // Impact" - inny sklad. Zle logo na profilu wyglada dokladnie jak prawda,
  // wiec brak logo jest tu lepszy od zgadywania.
  const { pickExactTeam } = await import(LOGOS);

  const kandydaci = [
    { name: "Ninjas in Pyjamas Impact", image_url: "x" },
    { name: "NIP Academy", image_url: "y" },
  ];

  assert.equal(pickExactTeam(kandydaci, "Ninjas in Pyjamas"), null);
});

test("trafia po nazwie, akronimie albo slugu", async () => {
  const { pickExactTeam } = await import(LOGOS);

  const kandydaci = [
    { name: "Natus Vincere", acronym: "NAVI", slug: "natus-vincere" },
  ];

  assert.equal(pickExactTeam(kandydaci, "Natus Vincere")?.acronym, "NAVI");
  assert.equal(pickExactTeam(kandydaci, "NAVI")?.name, "Natus Vincere");
});

test("roznica w wielkosci liter nie przeszkadza", async () => {
  const { pickExactTeam } = await import(LOGOS);

  const kandydaci = [{ name: "TheMongolz", image_url: "x" }];

  assert.equal(pickExactTeam(kandydaci, "The MongolZ")?.name, "TheMongolz");
  assert.equal(pickExactTeam(kandydaci, "The Mongolz")?.name, "TheMongolz");
});

test("pusta odpowiedz i pusta nazwa to null", async () => {
  const { pickExactTeam } = await import(LOGOS);

  assert.equal(pickExactTeam([], "Spirit"), null);
  assert.equal(pickExactTeam(null, "Spirit"), null);
  assert.equal(pickExactTeam([{ name: "Spirit" }], ""), null);
});
