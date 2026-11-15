// Czy MECZE pytaja o druzyny TURNIEJU, a nie o roster serwera.
//
// PO CO. Etapy 2-3 przestawily na roster turnieju cztery formularze faz
// i pietnascie wywolan w bocie, ale mecze zostaly przy wlasnych, surowych
// zapytaniach `SELECT name FROM teams WHERE ... active = 1` - w czterech
// miejscach. Skutek byl taki, ze roster turnieju nie dawal sie uzyc tam, gdzie
// turniej ma swoja liste: zakonczonego turnieju nie dalo sie poprawic, bo jego
// druzyny sa dawno wylaczone, wiec edycja meczu odbijala sie o 400 - choc mecz
// dotyczyl wlasnie ich.
//
// Zmiana jest cicha z natury: oba zapytania zwracaja nazwy druzyn i roznia sie
// tylko tym, KTORE. Dlatego oprocz testow zachowania jest tu straznik czytajacy
// pliki jako tekst - powrot surowego `active = 1` nie wywolalby zadnego bledu.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { normalizePhase } = require("../utils/phaseNames");

const KORZEN = path.join(__dirname, "..");

const GILDIA = "111222333444555666";

function fakeApp() {
  const trasy = new Map();

  const zapamietaj =
    (metoda) =>
    (sciezka, ...reszta) => {
      trasy.set(`${metoda} ${sciezka}`, reszta[reszta.length - 1]);
    };

  return {
    trasy,
    get: zapamietaj("GET"),
    post: zapamietaj("POST"),
    patch: zapamietaj("PATCH"),
    delete: zapamietaj("DELETE"),
    put: zapamietaj("PUT"),
  };
}

function fakeRes() {
  const zapis = { kod: 200, tresc: null };

  const res = {
    zapis,
    status(kod) {
      zapis.kod = kod;

      return res;
    },
    json(tresc) {
      zapis.tresc = tresc;

      return res;
    },
    send() {
      return res;
    },
  };

  return res;
}

// Atrapa puli. Zapamietuje zapytania, zeby dalo sie sprawdzic, ze NIE poszlo
// zadne pytanie o `active = 1`.
function fakePool() {
  const zapytania = [];

  return {
    zapytania,
    async query(sql, params) {
      const tekst = String(sql).replace(/\s+/g, " ").trim();

      zapytania.push({ sql: tekst, params });

      if (tekst.includes("FROM events")) {
        return [[{ id: 42, guild_id: GILDIA, name: "Turniej" }], []];
      }

      if (tekst.includes("INSERT INTO matches")) return [{ insertId: 7 }, []];

      return [[], []];
    },
  };
}

/* ======================================================================
   TWORZENIE MECZU - server/routes/guildEvents.js
   ====================================================================== */

async function trasaTworzenia(pool, rosterTurnieju) {
  const { registerGuildEventRoutes } = await import(
    "../server/routes/guildEvents.js"
  );

  const app = fakeApp();

  const pytania = [];

  registerGuildEventRoutes(app, {
    getOpenEventId: async () => 42,
    io: { emit: () => {} },
    loadEventTeamNames: async (_pool, opcje) => {
      pytania.push(opcje);

      return rosterTurnieju;
    },
    logInfo: () => {},
    nextMatchNumber: async () => 1,
    normalizePhase,
    parseMatchList: () => ({ mecze: [], bledy: [], duplikaty: [] }),
    pool,
    recalculateMatchPoints: async () => {},
    requireGuildAdmin: () => (req, res, next) => next(),
    runInTransaction: async (_p, fn) => fn(pool),
  });

  return {
    handler: app.trasy.get("POST /api/guilds/:guildId/events/:slug/matches"),
    pytania,
  };
}

function zadanie(teamA, teamB) {
  return {
    params: { guildId: GILDIA, slug: "turniej" },
    body: { phase: "swiss_stage1", teamA, teamB, bestOf: 3 },
  };
}

test("mecz powstaje dla druzyny z rostera, choc jest WYLACZONA na serwerze", async () => {
  // To jest cel calej zmiany: turniej z wlasna lista przyjmuje swoje druzyny
  // takze wtedy, gdy slownik serwera dawno je wylaczyl.
  const pool = fakePool();

  const { handler } = await trasaTworzenia(pool, ["Vitality", "Spirit"]);

  const res = fakeRes();

  await handler(zadanie("Vitality", "Spirit"), res);

  assert.equal(res.zapis.kod, 200);

  assert.ok(
    pool.zapytania.some((z) => z.sql.includes("INSERT INTO matches")),
    "mecz nie zostal zapisany",
  );
});

test("mecz dla druzyny spoza listy turnieju jest odrzucany z kodem", async () => {
  const pool = fakePool();

  const { handler } = await trasaTworzenia(pool, ["Vitality", "Spirit"]);

  const res = fakeRes();

  await handler(zadanie("Vitality", "Astralis"), res);

  assert.equal(res.zapis.kod, 400);
  assert.equal(res.zapis.tresc.code, "server.bothTeamsInEvent");

  assert.ok(
    !pool.zapytania.some((z) => z.sql.includes("INSERT INTO matches")),
    "odrzucony mecz nie moze zostac zapisany",
  );
});

test("pytanie o druzyny podaje TURNIEJ, nie tylko serwer", async () => {
  // Brak eventId dalby zapas zawsze, czyli roster turnieju nie dzialalby
  // nigdy - i nic by tego nie pokazalo.
  const pool = fakePool();

  const { handler, pytania } = await trasaTworzenia(pool, ["Vitality", "Spirit"]);

  await handler(zadanie("Vitality", "Spirit"), fakeRes());

  assert.equal(pytania.length, 1);
  assert.equal(pytania[0].eventId, 42);
  assert.equal(pytania[0].guildId, GILDIA);
});

test("tworzenie meczu nie pyta juz bazy o active = 1", async () => {
  const pool = fakePool();

  const { handler } = await trasaTworzenia(pool, ["Vitality", "Spirit"]);

  await handler(zadanie("Vitality", "Spirit"), fakeRes());

  const surowe = pool.zapytania.filter(
    (z) => z.sql.includes("FROM teams") && z.sql.includes("active = 1"),
  );

  assert.deepEqual(surowe, [], "zostalo surowe pytanie o roster serwera");
});

/* ======================================================================
   EDYCJA MECZU - server/routes/matches.js
   ====================================================================== */

async function trasaEdycji(pool, rosterTurnieju, mecz) {
  const { registerMatchRoutes } = await import("../server/routes/matches.js");

  const app = fakeApp();

  const pytania = [];

  registerMatchRoutes(app, {
    getLockBeforeSec: () => 0,
    guildIdFromMatchId: () => GILDIA,
    io: { emit: () => {} },
    isMatchStarted: () => false,
    loadEventTeamNames: async (_pool, opcje) => {
      pytania.push(opcje);

      return rosterTurnieju;
    },
    logInfo: () => {},
    logWarn: () => {},
    matchesStore: {
      getMatchById: async () => mecz,
    },
    policzDaneMeczu: async () => ({}),
    pool,
    recalculateMatchPoints: async () => {},
    requireGuildAdmin: () => (req, res, next) => next(),
    runInTransaction: async (_p, fn) => fn(pool),
  });

  const sciezka = [...app.trasy.keys()].find(
    (k) => k.startsWith("PATCH") && k.includes(":matchId"),
  );

  return { handler: app.trasy.get(sciezka), pytania };
}

const MECZ = {
  id: 9,
  event_id: 42,
  guild_id: GILDIA,
  team_a: "Vitality",
  team_b: "Spirit",
  best_of: 3,
  start_time_utc: null,
  phase: "SWISS_STAGE_1",
};

test("edycja meczu pyta o roster TEGO turnieju, po event_id z meczu", async () => {
  // Trasa dostaje tylko matchId - gdyby eventId brala skadkolwiek indziej
  // (albo nie brala wcale), poprawianie meczu zakonczonego turnieju nadal
  // odbijaloby sie o roster biezacego.
  const pool = fakePool();

  const { handler, pytania } = await trasaEdycji(
    pool,
    ["Vitality", "FURIA"],
    MECZ,
  );

  const res = fakeRes();

  await handler(
    {
      params: { guildId: GILDIA, matchId: "9" },
      body: { teamB: "FURIA" },
    },
    res,
  );

  assert.equal(pytania.length, 1);
  assert.equal(pytania[0].eventId, 42, "eventId musi pochodzic z wiersza meczu");

  assert.notEqual(res.zapis.kod, 400);
});

test("edycja na druzyne spoza listy turnieju konczy sie kodem", async () => {
  const pool = fakePool();

  const { handler } = await trasaEdycji(pool, ["Vitality", "Spirit"], MECZ);

  const res = fakeRes();

  await handler(
    {
      params: { guildId: GILDIA, matchId: "9" },
      body: { teamB: "Astralis" },
    },
    res,
  );

  assert.equal(res.zapis.kod, 400);
  assert.equal(res.zapis.tresc.code, "server.bothTeamsInEvent");
});

/* ======================================================================
   STRAZNIK TEKSTOWY
   ====================================================================== */

test("zadna sciezka zapisu meczu nie pyta o active = 1 wprost", () => {
  // Powrot surowego zapytania nie wywolalby bledu - oba zwracaja nazwy
  // druzyn. Rozniloby sie tylko to, ktore.
  const pliki = [
    "server/routes/guildEvents.js",
    "server/routes/matches.js",
    "handlers/matches/matchAddFlow.js",
  ];

  for (const nazwa of pliki) {
    const tresc = fs.readFileSync(path.join(KORZEN, nazwa), "utf8");

    // Komentarze wolno - mowia wlasnie o tym, czego juz nie ma.
    const bezKomentarzy = tresc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    assert.doesNotMatch(
      bezKomentarzy,
      /FROM teams[\s\S]{0,120}active\s*=\s*1/,
      `${nazwa}: wrocilo surowe pytanie o roster serwera`,
    );

    assert.match(
      bezKomentarzy,
      /loadEventTeamNames\s*\(/,
      `${nazwa}: nie pyta o roster turnieju`,
    );
  }
});

/* ======================================================================
   FRONT - web/src/lib/eventRoster.js
   ====================================================================== */

const ROSTER_LIB = "../web/src/lib/eventRoster.js";

const SLOWNIK = [
  { id: 1, name: "Vitality", active: 0 },
  { id: 2, name: "Spirit", active: 0 },
  { id: 3, name: "FaZe Clan", active: 1 },
];

test("bez rostera obowiazuja aktywne druzyny serwera", async () => {
  const { effectiveEventTeams } = await import(ROSTER_LIB);

  const wynik = effectiveEventTeams({ hasRoster: false, teams: SLOWNIK });

  assert.deepEqual(
    wynik.map((t) => t.name),
    ["FaZe Clan"],
  );
});

test("z rosterem obowiazuje roster - takze druzyny wylaczone", async () => {
  const { effectiveEventTeams } = await import(ROSTER_LIB);

  const wynik = effectiveEventTeams({
    hasRoster: true,
    teamIds: [1, 2],
    teams: SLOWNIK,
  });

  assert.deepEqual(
    wynik.map((t) => t.name),
    ["Vitality", "Spirit"],
    "wylaczona druzyna z rostera musi zostac na liscie",
  );
});

test("kolejnosc slownika zostaje zachowana", async () => {
  const { effectiveEventTeams } = await import(ROSTER_LIB);

  const wynik = effectiveEventTeams({
    hasRoster: true,
    teamIds: [3, 1],
    teams: SLOWNIK,
  });

  assert.deepEqual(
    wynik.map((t) => t.name),
    ["Vitality", "FaZe Clan"],
    "kolejnosc bierze sie ze slownika, nie z kolejnosci teamIds",
  );
});

test("druzyna meczu doklada sie, gdy wypadla z listy", async () => {
  const { withExtraTeams } = await import(ROSTER_LIB);

  const wynik = withExtraTeams([{ id: 3, name: "FaZe Clan" }], "Astralis");

  assert.deepEqual(
    wynik.map((t) => t.name),
    ["FaZe Clan", "Astralis"],
  );
});

test("doklejanie nie powtarza nazwy, ktora juz jest", async () => {
  const { withExtraTeams } = await import(ROSTER_LIB);

  const lista = [{ id: 3, name: "FaZe Clan" }];

  const wynik = withExtraTeams(lista, "FaZe Clan", null, undefined, "");

  assert.equal(wynik.length, 1);
  assert.equal(wynik, lista, "bez zmian oddaj te sama tablice");
});

test("doklejone pozycje maja klucze, ktore nie zderza sie z id", async () => {
  const { withExtraTeams } = await import(ROSTER_LIB);

  const wynik = withExtraTeams([{ id: 3, name: "FaZe Clan" }], "Astralis");

  const klucze = wynik.map((t) => String(t.id));

  assert.equal(new Set(klucze).size, klucze.length);
  assert.ok(
    Number.isNaN(Number(klucze[1])),
    "doklejony klucz nie moze byc liczba - prawdziwe id nia sa",
  );
});
