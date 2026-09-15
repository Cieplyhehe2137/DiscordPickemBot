// Statystyki druzyn (server/lib/teamStats.js).
//
// Testy pilnuja tego, co przy prawdziwych danych daje liczby wygladajace jak
// prawda: meczu bez wyniku policzonego jako przegrana, dwoch zapisow tej
// samej druzyny liczonych osobno i procentow z dzielenia przez zero.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/teamStats.js";

function mecz(nadpisania = {}) {
  return {
    id: 1,
    event_id: 7,
    event_name: "IEM",
    event_slug: "iem",
    phase: "playoffs",
    team_a: "FaZe",
    team_b: "Vitality",
    res_a: 2,
    res_b: 1,
    ...nadpisania,
  };
}

function podzial(match_id, for_a, for_b, total) {
  return { match_id, for_a, for_b, total };
}

function znajdz(teams, nazwa) {
  return teams.find((t) => t.name === nazwa);
}

test("bilans liczy sie z wynikow meczow", async () => {
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [
      mecz({ id: 1, res_a: 2, res_b: 0 }),
      mecz({ id: 2, res_a: 0, res_b: 2 }),
      mecz({ id: 3, res_a: 2, res_b: 1 }),
    ],
    [],
    [],
  );

  const faze = znajdz(teams, "FaZe");

  assert.equal(faze.matches, 3);
  assert.equal(faze.wins, 2);
  assert.equal(faze.losses, 1);
  assert.equal(faze.win_rate, 67);
});

test("mecz bez wyniku nie jest przegrana", async () => {
  // Number(null) to zero, wiec bez jawnego sprawdzenia nierozegrany mecz
  // wygladalby na remis 0:0 - i obie druzyny dostalyby przegrana.
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [mecz({ id: 1, res_a: null, res_b: null })],
    [],
    [],
  );

  const faze = znajdz(teams, "FaZe");

  assert.equal(faze.matches, 1);
  assert.equal(faze.settled, 0);
  assert.equal(faze.wins, 0);
  assert.equal(faze.losses, 0);
  assert.equal(faze.win_rate, null, "bez rozegranych meczow nie ma procentu");
});

test("polowa wyniku to wciaz brak wyniku", async () => {
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats([mecz({ res_a: 2, res_b: null })], [], []);

  assert.equal(znajdz(teams, "FaZe").settled, 0);
});

test("rozna wielkosc liter to jedna druzyna", async () => {
  // "PARIVISION" i "Parivision" wystepuja w bazie oba naraz.
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [
      mecz({ id: 1, team_a: "PARIVISION", res_a: 2, res_b: 0 }),
      mecz({ id: 2, team_a: "Parivision", res_a: 2, res_b: 0 }),
    ],
    [],
    [],
  );

  const pari = teams.filter((t) => t.key === "parivision");

  assert.equal(pari.length, 1, "jeden wiersz, nie dwa");
  assert.equal(pari[0].matches, 2);
});

test("sklejone zapisy tej samej organizacji licza sie razem", async () => {
  // "FUT" i "FUT Esports" to jedyna para w meczach, ktorej sama normalizacja
  // nie skleja - sprawdzone na wszystkich czterdziestu zapisach w bazie.
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [
      mecz({ id: 1, team_a: "FUT", res_a: 2, res_b: 0 }),
      mecz({ id: 2, team_a: "FUT Esports", res_a: 2, res_b: 0 }),
    ],
    [],
    [],
  );

  const fut = teams.filter((t) => t.key === "futesports");

  assert.equal(fut.length, 1, "jeden wiersz, nie dwa");
  assert.equal(fut[0].matches, 2);

  // Do pokazania idzie pelniejszy zapis.
  assert.equal(fut[0].name, "FUT Esports");
});

test("podobny poczatek nazwy NIE skleja dwoch skladow", async () => {
  // "Ninjas in Pyjamas" i "Ninjas in Pyjamas Impact" to dwie rozne druzyny.
  // Sklejanie po podobienstwie zlaczyloby im statystyki, a taki blad wyglada
  // dokladnie jak prawda.
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [
      mecz({ id: 1, team_a: "Ninjas in Pyjamas" }),
      mecz({ id: 2, team_a: "Ninjas in Pyjamas Impact" }),
    ],
    [],
    [],
  );

  const nip = teams.filter((t) => t.key.startsWith("ninjasinpyjamas"));

  assert.equal(nip.length, 2, "dwa osobne wiersze");
});

test("zaufanie to udzial typow na te druzyne", async () => {
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [mecz({ id: 1 })],
    [podzial(1, 30, 10, 40)],
    [],
  );

  assert.equal(znajdz(teams, "FaZe").trust, 75);
  assert.equal(znajdz(teams, "Vitality").trust, 25);
});

test("zaufanie i jego skutek to dwie rozne rzeczy", async () => {
  // Druzyna moze byc obstawiana chetnie i przegrywac.
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [
      mecz({ id: 1, res_a: 0, res_b: 2 }),
      mecz({ id: 2, res_a: 0, res_b: 2 }),
    ],
    [podzial(1, 30, 10, 40), podzial(2, 30, 10, 40)],
    [],
  );

  const faze = znajdz(teams, "FaZe");

  assert.equal(faze.trust, 75, "obstawiana chetnie");
  assert.equal(faze.trust_hit, 0, "i nie wygrala ani razu");
  assert.equal(faze.win_rate, 0);
});

test("brak typow daje null, a nie zero procent", async () => {
  // "Nikt nie typowal" i "nikt nie postawil na te druzyne" to dwie rozne
  // rzeczy, a zero pokazane w obu przypadkach klamie w pierwszym.
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats([mecz()], [], []);

  const faze = znajdz(teams, "FaZe");

  assert.equal(faze.trust, null);
  assert.equal(faze.trust_hit, null);
});

test("logo dopina sie po nazwie znormalizowanej", async () => {
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [mecz({ team_a: "FaZe Clan" })],
    [],
    [{ name_key: "fazeclan", logo_url: "https://cdn/faze.png" }],
  );

  assert.equal(znajdz(teams, "FaZe Clan").logo, "https://cdn/faze.png");
});

test("wpis logo bez adresu nie nadpisuje niczym", async () => {
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [mecz()],
    [],
    [{ name_key: "faze", logo_url: null }],
  );

  assert.equal(znajdz(teams, "FaZe").logo, null);
});

test("historia meczu trafia do obu druzyn", async () => {
  const { buildTeamStats } = await import(MODUL);

  const { history } = buildTeamStats([mecz({ id: 5 })], [], []);

  assert.equal(history.get("faze").length, 1);
  assert.equal(history.get("vitality").length, 1);
  assert.equal(history.get("faze")[0].match_id, 5);
});

test("liczba turniejow liczy kazdy raz, nie kazdy mecz", async () => {
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [
      mecz({ id: 1, event_id: 7 }),
      mecz({ id: 2, event_id: 7 }),
      mecz({ id: 3, event_id: 8 }),
    ],
    [],
    [],
  );

  assert.equal(znajdz(teams, "FaZe").events, 2);
});

test("pusta baza daje pusta liste, a nie wyjatek", async () => {
  const { buildTeamStats } = await import(MODUL);

  const { teams, history } = buildTeamStats([], [], []);

  assert.deepEqual(teams, []);
  assert.equal(history.size, 0);

  const puste = buildTeamStats(null, null, null);

  assert.deepEqual(puste.teams, []);
});

test("nazwa bez liter i cyfr nie tworzy druzyny", async () => {
  // W bazie zdarzaja sie myslniki zamiast nazw.
  const { buildTeamStats } = await import(MODUL);

  const { teams } = buildTeamStats(
    [mecz({ team_a: "—", team_b: "Vitality" })],
    [],
    [],
  );

  assert.equal(teams.length, 0, "mecz bez obu nazw nie liczy sie wcale");
});

test("kolejnosc listy idzie od najczesciej grajacych", async () => {
  const { buildTeamStats, sortTeams } = await import(MODUL);

  const { teams } = buildTeamStats(
    [
      mecz({ id: 1, team_a: "FaZe", team_b: "Vitality" }),
      mecz({ id: 2, team_a: "FaZe", team_b: "MOUZ" }),
      mecz({ id: 3, team_a: "FaZe", team_b: "G2" }),
      mecz({ id: 4, team_a: "MOUZ", team_b: "G2" }),
    ],
    [],
    [],
  );

  const kolejnosc = sortTeams(teams).map((t) => t.name);

  assert.equal(kolejnosc[0], "FaZe", "trzy mecze");
  assert.equal(kolejnosc[1], "G2", "dwa mecze, alfabetycznie przed MOUZ");
  assert.equal(kolejnosc[2], "MOUZ");
  assert.equal(kolejnosc[3], "Vitality", "jeden mecz");
});

test("kazda druzyna dostaje wpis z wlasna strona meczu", async () => {
  // Bez tego widok musialby zgadywac strone z porownania nazw, a nazwa
  // wyswietlana bywa INNYM zapisem niz ten w meczu ("FUT Esports" wobec
  // "FUT") - porownanie wychodzi wtedy odwrotnie i wygrana pokazuje sie
  // jako przegrana.
  const { buildTeamStats } = await import(MODUL);

  const { history } = buildTeamStats(
    [mecz({ id: 1, team_a: "FaZe", team_b: "Vitality" })],
    [],
    [],
  );

  assert.equal(history.get("faze")[0].side, "a");
  assert.equal(history.get("vitality")[0].side, "b");
});

test("strona meczu jest poprawna takze po sklejeniu zapisow", async () => {
  const { buildTeamStats } = await import(MODUL);

  const { history } = buildTeamStats(
    [mecz({ id: 1, team_a: "Vitality", team_b: "FUT", res_a: 0, res_b: 2 })],
    [],
    [],
  );

  const wpis = history.get("futesports")[0];

  assert.equal(wpis.side, "b", "FUT stalo po stronie B");

  // Czyli z punktu widzenia FUT wynik to 2:0, a nie 0:2.
  const nasze = wpis.side === "a" ? wpis.res_a : wpis.res_b;
  const ich = wpis.side === "a" ? wpis.res_b : wpis.res_a;

  assert.equal(nasze, 2);
  assert.equal(ich, 0);
});
