// Dostawca map: CitoAPI (server/lib/mapProviders/cito.js).
//
// KSZTALT FIKSTUR JEST POTWIERDZONY NA ZYWYM API - 11 pazdziernika 2026,
// turniej cs2-event-8244 "ESL Pro League Season 24": jedno zapytanie
// zwrocilo 41 meczow i 125 map. Nazwy pol nizej (team1Id, team2Id,
// startsAt, maps[].mapNumber, maps[].mapName, maps[].pickTeamId) sa
// przepisane z tamtej odpowiedzi. Wartosci sa nasze, zeby nie wnosic do
// repozytorium cudzych danych - ich regulamin zabrania redystrybucji.
//
// NAJWAZNIEJSZA RZECZ W TYM PLIKU: przelozenie ICH pickTeamId na NASZE
// TEAM_A / TEAM_B. Ich kolejnosc druzyn nie musi byc nasza - sprawdzone na
// produkcji, nasz mecz #39 to "Spirit vs MOUZ", a u nich team1 to MOUZ.
// Gdyby przepisac pickera wprost, polowa pickow trafilaby do zlej druzyny.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/mapProviders/cito.js";

/** Nasz mecz: Spirit jako druzyna A. */
const NASZ = {
  team_a: "Spirit",
  team_b: "MOUZ",
  best_of: 3,
  start_time_utc: "2026-10-10 17:00:00",
};

/** Ich rekord TEJ SAMEJ serii - ale z ODWROCONA kolejnoscia druzyn. */
const ICH = {
  id: "cs2-match-2398755",
  startsAt: "2026-10-10T17:10:00.000Z",
  bestOf: 3,
  team1Id: "cs2-team-4494",
  team1Name: "MOUZ",
  team2Id: "cs2-team-7020",
  team2Name: "Spirit",
  maps: [
    { mapNumber: 1, mapName: "Dust2", pickTeamId: "cs2-team-7020" },
    { mapNumber: 2, mapName: "Mirage", pickTeamId: "cs2-team-4494" },
    { mapNumber: 3, mapName: "Nuke", pickTeamId: null },
  ],
};

/* ---------------- zadanie ---------------- */

test("KLUCZ NIE MOZE TRAFIC DO ADRESU", async () => {
  // Adres laduje w logach posrednikow i w historii.
  const { buildEventMatchesRequest } = await import(MODUL);

  const z = buildEventMatchesRequest({
    key: "TAJNY-KLUCZ-123",
    eventId: "cs2-event-8244",
  });

  assert.equal(z.ok, true);
  assert.equal(z.url.includes("TAJNY-KLUCZ-123"), false, "klucz w adresie");
  assert.equal(z.headers["x-api-key"], "TAJNY-KLUCZ-123");
});

test("jedno zapytanie bierze CALY turniej", async () => {
  // To jest cala oszczednosc: mapy przychodza w liscie meczow eventu, wiec
  // 42 mecze kosztuja jedno zapytanie, a nie czterdziesci dwa.
  const { buildEventMatchesRequest } = await import(MODUL);

  const z = buildEventMatchesRequest({ key: "k", eventId: "cs2-event-8244" });

  assert.match(z.url, /\/cs2\/events\/cs2-event-8244\/matches/);
});

test("bez klucza albo bez turnieju nie powstaje zadanie", async () => {
  const { buildEventMatchesRequest } = await import(MODUL);

  assert.equal(buildEventMatchesRequest({ eventId: "x" }).ok, false);
  assert.equal(buildEventMatchesRequest({ key: "k" }).ok, false);
  assert.equal(buildEventMatchesRequest({ key: "", eventId: "x" }).ok, false);
});

test("budzet miesci sie w ich darmowym planie", async () => {
  // Darmowy plan to 500 zapytan na miesiac. Przekroczenie to nie jest
  // "wolniej", tylko utrata dostepu.
  const { LIMIT_NA_MIESIAC } = await import(MODUL);

  assert.ok(LIMIT_NA_MIESIAC <= 500, `budzet ${LIMIT_NA_MIESIAC} > 500`);
});

test("lista meczow wychodzi z opakowania 'data'", async () => {
  const { extractMatches } = await import(MODUL);

  assert.equal(extractMatches({ data: [ICH] }).length, 1);
  assert.equal(extractMatches([ICH]).length, 1);
  assert.deepEqual(extractMatches(null), []);
  assert.deepEqual(extractMatches({ data: { matches: [ICH] } }).length, 1);
});

/* ---------------- parowanie ---------------- */

test("paruje po druzynach I godzinie naraz", async () => {
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({ nasz: NASZ, rekord: ICH });

  assert.equal(w.ok, true);
  assert.equal(w.roznicaMinut, 10, "mecz zaczal sie 10 minut po zapowiedzi");
});

test("TE SAME DRUZYNY w innym terminie to INNY mecz", async () => {
  // Spirit gra z MOUZ kilka razy w sezonie.
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({
    nasz: { ...NASZ, start_time_utc: "2026-03-10 17:00:00" },
    rekord: ICH,
  });

  assert.equal(w.ok, false);
  assert.match(w.reason, /godziny odlegle/);
});

test("AKADEMIA NIE UCHODZI za pierwsza druzyne", async () => {
  // Luzniejsze porownanie nazw ma koszt: "Vitality" i "Vitality Academy"
  // roznia sie jednym slowem. Dlatego kazda z naszych druzyn musi znalezc
  // WLASNA druzyne po ich stronie.
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({
    nasz: { team_a: "Vitality", team_b: "MOUZ", start_time_utc: NASZ.start_time_utc },
    rekord: {
      ...ICH,
      team1Name: "Vitality",
      team2Name: "Vitality Academy",
    },
  });

  assert.equal(w.ok, false);
});

test("obie rodziny aliasow dzialaja naraz", async () => {
  // Tablica scalen zalatwia "Natus Vincere" = "NAVI", zdjecie ozdobnikow
  // zalatwia "Team Vitality" = "Vitality". Samo zdjecie ozdobnikow PSUJE
  // pierwsza rodzine, bo omija tablice.
  const { matchesOurMatch } = await import(MODUL);

  for (const [nasza, ich] of [
    ["Natus Vincere", "NAVI"],
    ["Team Vitality", "Vitality"],
    ["FaZe Clan", "FaZe"],
  ]) {
    const w = matchesOurMatch({
      nasz: { team_a: nasza, team_b: "MOUZ", start_time_utc: NASZ.start_time_utc },
      rekord: { ...ICH, team1Name: ich, team2Name: "MOUZ" },
    });

    assert.equal(w.ok, true, `"${nasza}" vs "${ich}"`);
  }
});

/* ---------------- przelozenie pickera ---------------- */

test("PICKER PRZEKLADA SIE NA NASZE STRONY, nie na ich", async () => {
  // TO JEST NAJWAZNIEJSZY TEST TEGO PLIKU.
  //
  // Nasz mecz to "Spirit vs MOUZ", ich rekord ma team1 = MOUZ. Mape 1
  // wypickowal cs2-team-7020, czyli Spirit, czyli NASZA druzyna A.
  // Gdyby przepisac pickera wprost z ich kolejnosci, wyszloby TEAM_B.
  const { mapsForOurMatch } = await import(MODUL);

  const { names, pickers } = mapsForOurMatch({ nasz: NASZ, rekord: ICH });

  assert.deepEqual(names, ["Dust2", "Mirage", "Nuke"]);
  assert.deepEqual(pickers, ["TEAM_A", "TEAM_B", "DECIDER"]);
});

test("ten sam mecz z NASZA kolejnoscia druzyn daje odwrotnosc", async () => {
  // Kontrola krzyzowa: jesli zamienimy nasze druzyny miejscami, pickerzy
  // musza sie zamienic. Inaczej znaczyloby, ze cos jest na sztywno.
  const { mapsForOurMatch } = await import(MODUL);

  const { pickers } = mapsForOurMatch({
    nasz: { ...NASZ, team_a: "MOUZ", team_b: "Spirit" },
    rekord: ICH,
  });

  assert.deepEqual(pickers, ["TEAM_B", "TEAM_A", "DECIDER"]);
});

test("pickTeamId = null znaczy DECIDER", async () => {
  // Zmierzone: 41 takich na 125 map, czyli dokladnie po jednej na mecz.
  const { mapsForOurMatch } = await import(MODUL);

  const { pickers } = mapsForOurMatch({ nasz: NASZ, rekord: ICH });

  assert.equal(pickers[2], "DECIDER");
});

test("OBCY identyfikator znaczy NIE WIEM, a nie zgadywanie", async () => {
  const { mapsForOurMatch } = await import(MODUL);

  const { pickers } = mapsForOurMatch({
    nasz: NASZ,
    rekord: {
      ...ICH,
      maps: [{ mapNumber: 1, mapName: "Nuke", pickTeamId: "cs2-team-99999" }],
    },
  });

  assert.deepEqual(pickers, [null]);
});

test("dziura w numeracji zostaje dziura", async () => {
  // Numer mapy musi zgadzac sie z numerem w match_map_results. Gdyby mapa
  // druga wypadla, trzecia zapisalaby sie jako druga i wynik trafilby pod
  // zly numer.
  const { mapsForOurMatch } = await import(MODUL);

  const { names, pickers } = mapsForOurMatch({
    nasz: NASZ,
    rekord: {
      ...ICH,
      maps: [
        { mapNumber: 1, mapName: "Dust2", pickTeamId: "cs2-team-7020" },
        { mapNumber: 3, mapName: "Nuke", pickTeamId: null },
      ],
    },
  });

  assert.deepEqual(names, ["Dust2", null, "Nuke"]);
  assert.deepEqual(pickers, ["TEAM_A", null, "DECIDER"]);
});

test("mapy przychodza posortowane, nawet gdy ich nie sa", async () => {
  const { mapsForOurMatch } = await import(MODUL);

  const { names } = mapsForOurMatch({
    nasz: NASZ,
    rekord: {
      ...ICH,
      maps: [
        { mapNumber: 3, mapName: "Nuke", pickTeamId: null },
        { mapNumber: 1, mapName: "Dust2", pickTeamId: "cs2-team-7020" },
        { mapNumber: 2, mapName: "Mirage", pickTeamId: "cs2-team-4494" },
      ],
    },
  });

  assert.deepEqual(names, ["Dust2", "Mirage", "Nuke"]);
});

test("brak map nie wysypuje adaptera", async () => {
  const { mapsForOurMatch } = await import(MODUL);

  for (const smiec of [
    undefined,
    { nasz: NASZ },
    { nasz: NASZ, rekord: {} },
    { nasz: NASZ, rekord: { ...ICH, maps: null } },
    { nasz: NASZ, rekord: { ...ICH, maps: [] } },
  ]) {
    const w = mapsForOurMatch(smiec);

    assert.deepEqual(w.names, []);
    assert.deepEqual(w.pickers, []);
  }
});

test("zrodlo nazywa sie tak samo jak w kolumnie source", async () => {
  // Ochrona wpisow recznych stoi na tym jednym napisie.
  const { ZRODLO } = await import(MODUL);

  assert.equal(ZRODLO, "cito");
});

/* ---------------- calosc: adapter + regula zapisu ---------------- */

test("adapter i buildMatchMaps skladaja gotowe wiersze", async () => {
  // Droga od odpowiedzi dostawcy do wierszy w bazie, bez bazy.
  const { mapsForOurMatch, ZRODLO } = await import(MODUL);
  const { buildMatchMaps } = await import("../server/lib/matchMaps.js");

  const { names, pickers } = mapsForOurMatch({ nasz: NASZ, rekord: ICH });

  const w = buildMatchMaps({
    bestOf: NASZ.best_of,
    names,
    pickers,
    source: ZRODLO,
  });

  assert.equal(w.ok, true);
  assert.deepEqual(w.rows, [
    { map_no: 1, map_name: "Dust II", picked_by: "TEAM_A", source: "cito" },
    { map_no: 2, map_name: "Mirage", picked_by: "TEAM_B", source: "cito" },
    { map_no: 3, map_name: "Nuke", picked_by: "DECIDER", source: "cito" },
  ]);

  // "Dust2" to ich pisownia - nasza regula sprowadza ja do jednej postaci.
  assert.equal(w.rows[0].map_name, "Dust II");
});

/* ---------------- wybor rekordu sposrod wielu ---------------- */

test("GODZINA ROZSTRZYGA TYLKO WTEDY, gdy jest co rozstrzygac", async () => {
  // Zmierzone na produkcji: okno 150 minut odrzucilo 4 mecze z 41, ktore
  // dostawca ma razem z mapami - roznice wyniosly 155, 175, 185 i 205
  // minut. Mecze zaczynaja sie z opoznieniem, bo poprzednie na tej samej
  // scenie sie przeciagaja.
  //
  // Skoro te dwie druzyny zagraly ze soba w tym turnieju RAZ, nie ma czego
  // pomylic i godzina nie wnosi nic poza odrzuceniem dobrych danych.
  const { findRecordForMatch } = await import(MODUL);

  const pozno = { ...ICH, startsAt: "2026-10-10T20:25:00.000Z" }; // +205 min

  const w = findRecordForMatch({ nasz: NASZ, rekordy: [pozno] });

  assert.equal(w.ok, true);
  assert.equal(w.jedyny, true);
  assert.equal(w.roznicaMinut, 205);
});

test("DWA SPOTKANIA tych samych druzyn rozroznia godzina", async () => {
  // W tym turnieju tak graly dwie pary: "FURIA + MOUZ" i "MOUZ + Spirit".
  // Tu okno jest jedyna rzecza, ktora dzieli te mecze.
  const { findRecordForMatch } = await import(MODUL);

  const wczesniej = { ...ICH, id: "wczesniej", startsAt: "2026-10-03T12:00:00.000Z" };
  const blisko = { ...ICH, id: "blisko", startsAt: "2026-10-10T17:10:00.000Z" };

  const w = findRecordForMatch({ nasz: NASZ, rekordy: [wczesniej, blisko] });

  assert.equal(w.ok, true);
  assert.equal(w.rekord.id, "blisko");
  assert.equal(w.jedyny, false);
});

test("kilku kandydatow i zaden blisko - NIE ZGADUJEMY", async () => {
  const { findRecordForMatch } = await import(MODUL);

  const w = findRecordForMatch({
    nasz: NASZ,
    rekordy: [
      { ...ICH, id: "a", startsAt: "2026-10-03T12:00:00.000Z" },
      { ...ICH, id: "b", startsAt: "2026-10-05T12:00:00.000Z" },
    ],
  });

  assert.equal(w.ok, false);
  assert.match(w.reason, /spotkan tych druzyn/);
});

test("jedyny kandydat sprzed miesiaca to NIE nasz mecz", async () => {
  // Doba zapasu lapie poslizg transmisji, ale nie turniej z zeszlego roku.
  const { findRecordForMatch } = await import(MODUL);

  const w = findRecordForMatch({
    nasz: NASZ,
    rekordy: [{ ...ICH, startsAt: "2026-09-01T17:00:00.000Z" }],
  });

  assert.equal(w.ok, false);
  assert.match(w.reason, /odlegly/);
});

test("jedyny kandydat BEZ godziny i tak przechodzi", async () => {
  // Te dwie druzyny zagraly ze soba w turnieju raz - brak godziny niczego
  // tu nie zaciemnia.
  const { findRecordForMatch } = await import(MODUL);

  const w = findRecordForMatch({
    nasz: NASZ,
    rekordy: [{ ...ICH, startsAt: null }],
  });

  assert.equal(w.ok, true);
  assert.equal(w.roznicaMinut, null);
});

test("obce mecze nie podszywaja sie pod nasz", async () => {
  const { findRecordForMatch } = await import(MODUL);

  const w = findRecordForMatch({
    nasz: NASZ,
    rekordy: [
      { ...ICH, team1Name: "FaZe", team2Name: "G2" },
      { ...ICH, team1Name: "Vitality", team2Name: "Aurora" },
    ],
  });

  assert.equal(w.ok, false);
  assert.match(w.reason, /nie znaleziono/);
});

test("pusta lista rekordow nie wysypuje wyboru", async () => {
  const { findRecordForMatch } = await import(MODUL);

  assert.equal(findRecordForMatch({ nasz: NASZ, rekordy: [] }).ok, false);
  assert.equal(findRecordForMatch({ nasz: NASZ }).ok, false);
  assert.equal(findRecordForMatch().ok, false);
});
