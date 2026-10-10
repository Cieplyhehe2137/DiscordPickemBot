// Godzina startu meczu w trasach API.
//
// Regula zyje w server/lib/startTime.js i ma wlasne testy. Tutaj chodzi
// o to, czy KAZDA trasa przyjmujaca godzine faktycznie przez nia idzie -
// bo blad wzial sie stad, ze jedna z nich szla obok.
//
// Atrapa puli - nic nie laczy sie z baza.

const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizePhase } = require("../utils/phaseNames");

// Sciana zegara z <input type="datetime-local"> - dokladnie to, co
// formularz "dodaj mecz" wysylal przez pol roku.
const BEZ_STREFY = "2026-10-05T16:00";

// Ta sama chwila, powiedziana jednoznacznie.
const ZE_STREFA = "2026-10-05T14:00:00.000Z";
const W_BAZIE = "2026-10-05 14:00:00";

function fakeApp() {
  const trasy = new Map();

  const zapamietaj = (metoda) => (sciezka, ...reszta) => {
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

/** Atrapa puli: zapisuje kazde zapytanie i oddaje przygotowane wiersze. */
function fakePool(odpowiedz) {
  const wywolania = [];

  return {
    wywolania,
    async query(sql, params) {
      wywolania.push({ sql: String(sql), params });

      return [odpowiedz(String(sql)) ?? [], []];
    },
  };
}

/** Zapytania zapisujace godzine - tylko one nas tu interesuja. */
function zapisyGodziny(pool) {
  return pool.wywolania.filter((w) => /start_time_utc\s*=|INSERT INTO matches/i.test(w.sql));
}

/* ---------------- tworzenie meczu ---------------- */

async function trasaTworzenia(pool) {
  const { registerGuildEventRoutes } = await import(
    "../server/routes/guildEvents.js"
  );

  const app = fakeApp();

  registerGuildEventRoutes(app, {
    getOpenEventId: async () => 7,
    io: { emit: () => {} },
    logInfo: () => {},
    nextMatchNumber: async () => 1,
    normalizePhase,
    parseMatchList: () => ({ mecze: [], bledy: [], duplikaty: [] }),
    pool,
    recalculateMatchPoints: async () => {},
    requireGuildAdmin: () => (req, res, next) => next(),
    runInTransaction: async (_p, fn) => fn(pool),
  });

  return app.trasy.get("POST /api/guilds/:guildId/events/:slug/matches");
}

function daneTworzenia(sql) {
  if (sql.includes("FROM events")) return [{ id: 7, name: "Event" }];
  if (sql.includes("FROM teams")) return [{ name: "A" }, { name: "B" }];
  if (sql.includes("INSERT INTO matches")) return { insertId: 123 };

  return [];
}

function zadanieTworzenia(startTimeUtc) {
  return {
    params: { guildId: "111", slug: "turniej" },
    body: {
      phase: "swiss_stage1",
      teamA: "A",
      teamB: "B",
      bestOf: 3,
      startTimeUtc,
    },
    session: {},
  };
}

test("tworzenie meczu ODRZUCA godzine bez strefy", async () => {
  // To jest ten blad: mecz z 16:00 polskiego czasu blokowal sie o 18:00
  // polskiego czasu, bo "2026-10-05T16:00" ladowalo w kolumnie czytanej
  // przez wszystkich jako UTC.
  const pool = fakePool(daneTworzenia);
  const handler = await trasaTworzenia(pool);
  const res = fakeRes();

  await handler(zadanieTworzenia(BEZ_STREFY), res);

  assert.equal(res.zapis.kod, 400);
  assert.equal(res.zapis.tresc.code, "server.startTimeNeedsZone");
  assert.equal(
    pool.wywolania.some((w) => w.sql.includes("INSERT INTO matches")),
    false,
    "mecz NIE moze powstac z godzina, ktorej nie rozumiemy",
  );
});

test("tworzenie meczu zapisuje chwile ze strefy jako UTC", async () => {
  const pool = fakePool(daneTworzenia);
  const handler = await trasaTworzenia(pool);
  const res = fakeRes();

  await handler(zadanieTworzenia(ZE_STREFA), res);

  assert.equal(res.zapis.kod, 200);

  const insert = pool.wywolania.find((w) => w.sql.includes("INSERT INTO matches"));

  assert.ok(insert, "mecz powinien powstac");
  assert.equal(insert.params[7], W_BAZIE);
  assert.equal(
    typeof insert.params[7],
    "string",
    "napis, nie Date - Date przechodzi przez strefe procesu",
  );
});

test("mecz bez godziny powstaje normalnie", async () => {
  const pool = fakePool(daneTworzenia);
  const handler = await trasaTworzenia(pool);
  const res = fakeRes();

  await handler(zadanieTworzenia(null), res);

  assert.equal(res.zapis.kod, 200);

  const insert = pool.wywolania.find((w) => w.sql.includes("INSERT INTO matches"));

  assert.equal(insert.params[7], null);
});

/* ---------------- ustawienie godziny istniejacemu meczowi ---------------- */

async function trasaStartu(pool) {
  const { registerMatchOpsRoutes } = await import("../server/routes/matchOps.js");

  const app = fakeApp();

  // Czterdziesci kilka zaleznosci, z ktorych ta trasa uzywa kilku. Proxy
  // oddaje atrape na kazda nazwe, ktorej nie podajemy wprost - inaczej
  // polowa tego pliku bylaby lista no-opow.
  const podane = {
    pool,
    io: { emit: () => {} },
    logInfo: () => {},
    logWarn: () => {},
    logError: () => {},
    getLockBeforeSec: () => 0,
    isMatchStarted: () => false,
    requireGuildAdmin: () => (req, res, next) => next(),
  };

  const zaleznosci = new Proxy(podane, {
    get(cel, nazwa) {
      if (nazwa in cel) return cel[nazwa];

      return () => {};
    },
    has: () => true,
  });

  registerMatchOpsRoutes(app, zaleznosci);

  return app.trasy.get("POST /api/matches/:matchId/start");
}

function daneStartu(sql) {
  if (sql.includes("FROM matches")) {
    return [{ id: 5, guild_id: "111", team_a: "A", team_b: "B" }];
  }

  return [];
}

function zadanieStartu(startTimeUtc) {
  return { params: { matchId: "5" }, body: { startTimeUtc }, session: {} };
}

test("ustawienie godziny ODRZUCA sciane zegara bez strefy", async () => {
  const pool = fakePool(daneStartu);
  const handler = await trasaStartu(pool);
  const res = fakeRes();

  await handler(zadanieStartu(BEZ_STREFY), res);

  assert.equal(res.zapis.kod, 400);
  assert.equal(res.zapis.tresc.code, "server.startTimeNeedsZone");
  assert.equal(
    zapisyGodziny(pool).length,
    0,
    "nic nie moze trafic do bazy przy godzinie bez strefy",
  );
});

test("ustawienie godziny zapisuje UTC jako napis", async () => {
  // Napis znaczy to samo niezaleznie od tego, czy pula ma `timezone` -
  // a pula bota go nie ma.
  const pool = fakePool(daneStartu);
  const handler = await trasaStartu(pool);
  const res = fakeRes();

  await handler(zadanieStartu(ZE_STREFA), res);

  assert.equal(res.zapis.kod, 200);

  const zapis = zapisyGodziny(pool).at(-1);

  assert.ok(zapis, "godzina powinna zostac zapisana");
  assert.equal(zapis.params[0], W_BAZIE);
  assert.equal(typeof zapis.params[0], "string");
  assert.equal(res.zapis.tresc.match.start_time_utc, W_BAZIE);
});

test("wyczyszczenie godziny dalej dziala", async () => {
  const pool = fakePool(daneStartu);
  const handler = await trasaStartu(pool);
  const res = fakeRes();

  await handler(zadanieStartu(null), res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(zapisyGodziny(pool).at(-1).params[0], null);
});

/* ---------------- straznik: zadna trasa nie idzie obok reguly ------------- */

test("kazda trasa przyjmujaca godzine idzie przez wspolna regule", () => {
  // Blad wzial sie z tego, ze jedna trasa czytala godzine po swojemu.
  // Gdyby doszla kolejna, ten test ma o tym powiedziec.
  const fs = require("node:fs");
  const path = require("node:path");

  const katalog = path.join(__dirname, "..", "server", "routes");

  const winni = [];

  for (const nazwa of fs.readdirSync(katalog)) {
    if (!nazwa.endsWith(".js")) continue;

    const tresc = fs
      .readFileSync(path.join(katalog, nazwa), "utf8")
      .replace(/\r\n/g, "\n");

    if (!tresc.includes("startTimeUtc")) continue;

    assert.ok(
      tresc.includes("parseStartTimeInput"),
      `${nazwa} czyta startTimeUtc, ale nie przez lib/startTime.js`,
    );

    // I nie robi tego po swojemu obok reguly.
    if (/new Date\(\s*startTimeUtc\s*\)/.test(tresc)) {
      winni.push(nazwa);
    }
  }

  assert.deepEqual(
    winni,
    [],
    `trasy czytajace godzine wlasnym new Date(): ${winni.join(", ")}`,
  );
});
