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

// --- trzy druzyny, ktore dlugo nie mialy logotypu ------------------------
//
// Aurora, Legacy i Ninjas in Pyjamas byly jedynymi bez obrazka na 39 nazw
// w bazie. Kazda z innego powodu i zaden nie byl "dostawca ich nie zna".

test("Ninjas in Pyjamas szuka sie pod skrotem, nie pod pelna nazwa", async () => {
  // Wyszukanie pelnej nazwy oddaje TYLKO sklad zenski ("Impact"). Pierwszy
  // sklad dostawca prowadzi pod "NIP".
  const { searchNameFor } = await import(LOGOS);

  assert.equal(searchNameFor("Ninjas in Pyjamas"), "NIP");
});

test("alias NIP nie wpuszcza skladu zenskiego", async () => {
  // Najwazniejszy test z tej trojki. Alias zmienia to, CZEGO szukamy, ale
  // nie moze poluzowac tego, co uznajemy za trafienie - "Ninjas in Pyjamas
  // Impact" to inna druzyna i ma nadal odpadac.
  const { pickExactTeam, searchNameFor } = await import(LOGOS);

  const kandydaci = [
    { name: "Ninjas in Pyjamas Impact", acronym: "NIP.I", slug: "ninjas-in-pyjamas-female", image_url: "zle" },
    { name: "NIP Svea", acronym: "NIP.S", slug: "nip-svea", image_url: "tez zle" },
    { name: "NIP", acronym: "NIP", slug: "nip", image_url: "dobre" },
  ];

  const trafiona = pickExactTeam(kandydaci, searchNameFor("Ninjas in Pyjamas"));

  assert.equal(trafiona?.image_url, "dobre");
});

test("Aurora idzie do wpisu, przy ktorym wisi obrazek", async () => {
  // Dokladne trafienie ("AURORA") u dostawcy istnieje, ale nie ma przy nim
  // zadnego obrazka - logotyp wisi przy dawnej nazwie organizacji.
  const { searchNameFor } = await import(LOGOS);

  assert.equal(searchNameFor("Aurora"), "Aurora Gaming");
});

test("przy remisie dokladnych trafien wygrywa to z obrazkiem", async () => {
  // Przypadek Legacy: dostawca ma dwa wiersze o tej samej nazwie i oddaje
  // je tak, ze pusty jest pierwszy. Poprzednio wygrywal wlasnie on.
  const { pickExactTeam } = await import(LOGOS);

  const kandydaci = [
    { name: "Legacy", acronym: null, slug: "legacy-134329", image_url: null },
    { name: "Legacy", acronym: "LGC", slug: "legacy-133708", image_url: "dobre" },
  ];

  assert.equal(pickExactTeam(kandydaci, "Legacy")?.image_url, "dobre");
});

test("remis rozstrzyga sie tylko miedzy DOKLADNYMI trafieniami", async () => {
  // Obrazek nie moze przewazyc nad dokladnoscia: druzyna niedokladna
  // z logotypem ma przegrac z dokladna bez logotypu. Inaczej ta zmiana
  // bylaby poluzowaniem dopasowania, a nie rozstrzygnieciem remisu.
  const { pickExactTeam } = await import(LOGOS);

  const kandydaci = [
    { name: "Legacy Gaming", acronym: "LG", slug: "legacy-cs-go", image_url: "obce" },
    { name: "Legacy", acronym: null, slug: "legacy-134329", image_url: null },
  ];

  assert.equal(pickExactTeam(kandydaci, "Legacy")?.name, "Legacy");
  assert.equal(pickExactTeam(kandydaci, "Legacy")?.image_url, null);
});
