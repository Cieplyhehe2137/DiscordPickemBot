// Synchronizacja map po veto (server/lib/mapSync.js).
//
// Jedna droga dla skryptu i dla watchera bota - dwie kopie tej samej logiki
// rozjechalyby sie o jeden warunek.
//
// NAJWAZNIEJSZE W TYM PLIKU TO BUDZET. Darmowy plan dostawcy to 500 zapytan
// na MIESIAC, a watcher tyka co trzydziesci minut. Gdyby pytal za kazdym
// razem, wyszloby 1440 zapytan miesiecznie i stracilibysmy dostep. Testy
// nizej licza ZAPYTANIA, nie milisekundy.
//
// Siec jest wstrzykiwana, baza jest atrapa - nic tu nie wychodzi na zewnatrz.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/mapSync.js";

const EVENT = { id: 7, name: "ESL Pro League Season 24" };

/** Nasz mecz, ktory czeka na mapy. */
const NASZ = {
  id: 5,
  guild_id: "111",
  event_id: 7,
  match_no: 39,
  best_of: 3,
  team_a: "Spirit",
  team_b: "MOUZ",
  start_time_utc: "2026-10-10 17:00:00",
  map_rows: 0,
  manual_rows: 0,
};

/** Ich rekord tej samej serii - z ODWROCONA kolejnoscia druzyn. */
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

/** Atrapa puli: oddaje podane mecze i zapisuje kazde zapytanie. */
function fakePool(kandydaci = []) {
  const wywolania = [];

  return {
    wywolania,

    async query(sql, params) {
      wywolania.push({ sql: String(sql), params });

      if (/FROM matches/i.test(String(sql))) return [kandydaci, []];

      return [{ affectedRows: 1 }, []];
    },
  };
}

/** Atrapa sieci: liczy zapytania i oddaje przygotowane odpowiedzi. */
function fakeSiec({ events = [{ id: "cs2-event-8244", name: EVENT.name }], mecze = [ICH] } = {}) {
  const url = [];

  const wolaj = async (adres) => {
    url.push(adres);

    if (adres.includes("/search")) return { data: { events } };

    return { data: mecze };
  };

  wolaj.url = url;

  return wolaj;
}

/** Zapytania wstawiajace mapy. */
function wstawienia(pool) {
  return pool.wywolania.filter((w) => /INSERT INTO match_maps/i.test(w.sql));
}

test.beforeEach(async () => {
  const { resetMapSyncCache } = await import(MODUL);

  resetMapSyncCache();
});

/* ---------------- budzet ---------------- */

test("BEZ KANDYDATOW nie idzie ANI JEDNO zapytanie do dostawcy", async () => {
  // To jest najwazniejsze zachowanie w tym pliku. Watcher tyka co pol
  // godziny przez caly miesiac; gdyby pytal za kazdym razem, wyszloby
  // 1440 zapytan przy limicie 500.
  const { syncEventMaps } = await import(MODUL);

  const pool = fakePool([]);
  const siec = fakeSiec();

  const raport = await syncEventMaps({
    pool,
    event: EVENT,
    key: "k",
    wolaj: siec,
    apply: true,
  });

  assert.equal(raport.ok, true);
  assert.equal(raport.zapytania, 0);
  assert.equal(siec.url.length, 0, "dostawca ruszony mimo braku roboty");
  assert.equal(wstawienia(pool).length, 0);
});

test("komplet map kosztuje DWA zapytania, potem jedno", async () => {
  // Pierwsze na odnalezienie turnieju, drugie na mecze. Identyfikator
  // turnieju jest buforowany, wiec kolejne przebiegi sa o polowe tansze.
  const { syncEventMaps } = await import(MODUL);

  const siec = fakeSiec();

  const pierwszy = await syncEventMaps({
    pool: fakePool([NASZ]),
    event: EVENT,
    key: "k",
    wolaj: siec,
    apply: false,
  });

  assert.equal(pierwszy.zapytania, 2);

  const drugi = await syncEventMaps({
    pool: fakePool([NASZ]),
    event: EVENT,
    key: "k",
    wolaj: siec,
    apply: false,
  });

  assert.equal(drugi.zapytania, 1, "identyfikator turnieju ma byc z bufora");
});

test("NIEZNANY TURNIEJ tez trafia do bufora", async () => {
  // Inaczej turniej, ktorego dostawca nie ma, kosztowalby wyszukiwanie
  // przy kazdym tyknieciu watchera - czyli 48 zapytan na dobe za nic.
  const { syncEventMaps } = await import(MODUL);

  const siec = fakeSiec({ events: [] });

  const pierwszy = await syncEventMaps({
    pool: fakePool([NASZ]),
    event: EVENT,
    key: "k",
    wolaj: siec,
    apply: false,
  });

  assert.equal(pierwszy.ok, false);
  assert.match(pierwszy.powod, /nie zna tego turnieju/);
  assert.equal(pierwszy.zapytania, 1);

  const drugi = await syncEventMaps({
    pool: fakePool([NASZ]),
    event: EVENT,
    key: "k",
    wolaj: siec,
    apply: false,
  });

  assert.equal(drugi.zapytania, 0, "pudlo ma zostac zapamietane");
});

test("podany wprost identyfikator oszczedza wyszukiwanie", async () => {
  const { syncEventMaps } = await import(MODUL);

  const siec = fakeSiec();

  const raport = await syncEventMaps({
    pool: fakePool([NASZ]),
    event: EVENT,
    key: "k",
    wolaj: siec,
    eventId: "cs2-event-8244",
    apply: false,
  });

  assert.equal(raport.zapytania, 1);
  assert.equal(
    siec.url.some((u) => u.includes("/search")),
    false,
  );
});

test("TYLKO DOKLADNA NAZWA turnieju - watcher nie ma komu pokazac watpliwosci", async () => {
  // Skrypt uruchamiany recznie moglby wziac pierwszego z brzegu i zapytac
  // czlowieka. Automat nie ma kogo zapytac, a zapisanie map z cudzego
  // turnieju byloby gorsze niz brak map.
  const { syncEventMaps } = await import(MODUL);

  const raport = await syncEventMaps({
    pool: fakePool([NASZ]),
    event: EVENT,
    key: "k",
    wolaj: fakeSiec({
      events: [{ id: "cs2-event-9999", name: "ESL Pro League Season 26" }],
    }),
    apply: false,
  });

  assert.equal(raport.ok, false);
  assert.match(raport.powod, /nie zna tego turnieju/);
});

test("brak klucza nie rusza ani bazy, ani sieci", async () => {
  const { syncEventMaps } = await import(MODUL);

  const pool = fakePool([NASZ]);
  const siec = fakeSiec();

  const raport = await syncEventMaps({ pool, event: EVENT, key: "", wolaj: siec });

  assert.equal(raport.ok, false);
  assert.equal(raport.zapytania, 0);
  assert.equal(pool.wywolania.length, 0);
  assert.equal(siec.url.length, 0);
});

/* ---------------- wybor kandydatow ---------------- */

test("pytamy o mecze, ktore SIE ZACZELY i nie sa za stare", async () => {
  // Dwa warunki naraz. Bez gornego mecz, ktorego dostawca nigdy nie pozna
  // (pokazowy, przelozony), trzymalby turniej w stanie "do zrobienia" na
  // zawsze i kazdy tick kosztowalby zapytanie.
  const { znajdzMeczeDoUzupelnienia } = await import(MODUL);

  const pool = fakePool([]);

  await znajdzMeczeDoUzupelnienia({ pool, eventId: 7 });

  const zapytanie = pool.wywolania[0];

  assert.match(zapytanie.sql, /start_time_utc <= DATE_SUB\(UTC_TIMESTAMP\(\), INTERVAL \? MINUTE\)/);
  assert.match(zapytanie.sql, /start_time_utc >= DATE_SUB\(UTC_TIMESTAMP\(\), INTERVAL \? DAY\)/);
  assert.deepEqual(zapytanie.params, [7, 5, 3]);
});

test("mecz z WPISEM RECZNYM jest pomijany", async () => {
  // Reka wygrywa - administrator wpisuje mapy z transmisji, czesto
  // szybciej, niz trafiaja gdziekolwiek indziej.
  const { znajdzMeczeDoUzupelnienia } = await import(MODUL);

  const pool = fakePool([
    { ...NASZ, manual_rows: 1, map_rows: 1 },
    { ...NASZ, id: 6, manual_rows: 0, map_rows: 0 },
  ]);

  const wynik = await znajdzMeczeDoUzupelnienia({ pool, eventId: 7 });

  assert.deepEqual(
    wynik.map((m) => m.id),
    [6],
  );
});

test("mecz z KOMPLETEM map jest pomijany", async () => {
  const { znajdzMeczeDoUzupelnienia } = await import(MODUL);

  const pool = fakePool([
    { ...NASZ, map_rows: 3, best_of: 3 },
    { ...NASZ, id: 6, map_rows: 2, best_of: 3 },
  ]);

  const wynik = await znajdzMeczeDoUzupelnienia({ pool, eventId: 7 });

  assert.deepEqual(
    wynik.map((m) => m.id),
    [6],
  );
});

/* ---------------- zapis ---------------- */

test("PODGLAD nie zapisuje nic", async () => {
  const { syncEventMaps } = await import(MODUL);

  const pool = fakePool([NASZ]);

  const raport = await syncEventMaps({
    pool,
    event: EVENT,
    key: "k",
    wolaj: fakeSiec(),
    apply: false,
  });

  assert.equal(raport.podglad, true);
  assert.equal(raport.plan.length, 1);
  assert.equal(wstawienia(pool).length, 0);
});

test("zapis wklada mapy z PRAWDZIWYM pickerem", async () => {
  const { syncEventMaps } = await import(MODUL);

  const pool = fakePool([NASZ]);

  const raport = await syncEventMaps({
    pool,
    event: EVENT,
    key: "k",
    wolaj: fakeSiec(),
    apply: true,
  });

  assert.equal(raport.zapisanych, 3);

  const w = wstawienia(pool);

  // guild_id, event_id, match_id, map_no, map_name, picked_by, source
  assert.deepEqual(w[0].params, ["111", 7, 5, 1, "Dust II", "TEAM_A", "cito"]);
  assert.deepEqual(w[1].params, ["111", 7, 5, 2, "Mirage", "TEAM_B", "cito"]);
  assert.deepEqual(w[2].params, ["111", 7, 5, 3, "Nuke", "DECIDER", "cito"]);
});

test("zapis CHRONI wiersze reczne warunkiem w samym zapytaniu", async () => {
  // Filtr kandydatow to za malo: miedzy odczytem a zapisem administrator
  // mogl zdazyc cos wpisac.
  const { syncEventMaps } = await import(MODUL);

  const pool = fakePool([NASZ]);

  await syncEventMaps({
    pool,
    event: EVENT,
    key: "k",
    wolaj: fakeSiec(),
    apply: true,
  });

  for (const w of wstawienia(pool)) {
    assert.match(
      w.sql,
      /IF\(match_maps\.source = 'manual'/,
      "zapis moze nadpisac wpis reczny",
    );
  }
});

test("mecz, ktorego dostawca nie ma, ladnie laduje w 'bez pary'", async () => {
  const { syncEventMaps } = await import(MODUL);

  const pool = fakePool([NASZ]);

  const raport = await syncEventMaps({
    pool,
    event: EVENT,
    key: "k",
    wolaj: fakeSiec({
      mecze: [{ ...ICH, team1Name: "FaZe", team2Name: "G2" }],
    }),
    apply: true,
  });

  assert.equal(raport.ok, true);
  assert.equal(raport.plan.length, 0);
  assert.equal(raport.bezPary.length, 1);
  assert.equal(wstawienia(pool).length, 0);
});

test("sparowany mecz BEZ nazw map nie tworzy pustych wierszy", async () => {
  const { syncEventMaps } = await import(MODUL);

  const pool = fakePool([NASZ]);

  const raport = await syncEventMaps({
    pool,
    event: EVENT,
    key: "k",
    wolaj: fakeSiec({
      mecze: [{ ...ICH, maps: [{ mapNumber: 1, pickTeamId: null }] }],
    }),
    apply: true,
  });

  assert.equal(raport.plan.length, 0);
  assert.match(raport.bezPary[0].powod, /bez nazw map/);
  assert.equal(wstawienia(pool).length, 0);
});
