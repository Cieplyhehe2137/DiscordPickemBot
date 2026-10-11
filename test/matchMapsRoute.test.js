// Zapis map meczu (PUT /api/matches/:matchId/maps).
//
// Regula walidacji zyje w server/lib/matchMaps.js i ma wlasne testy. Tutaj
// chodzi o to, co robi TRASA: czy pilnuje formatu serii, czy podmienia
// komplet map zamiast dopisywac, i czy wszystko leci jedna transakcja.
//
// Atrapa puli - nic nie laczy sie z baza.

const test = require("node:test");
const assert = require("node:assert/strict");

function fakeApp() {
  const trasy = new Map();

  const zapamietaj = (metoda) => (sciezka, ...reszta) => {
    trasy.set(`${metoda} ${sciezka}`, reszta[reszta.length - 1]);
  };

  return {
    trasy,
    get: zapamietaj("GET"),
    post: zapamietaj("POST"),
    put: zapamietaj("PUT"),
    patch: zapamietaj("PATCH"),
    delete: zapamietaj("DELETE"),
    use: () => {},
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

const MECZ = {
  id: 5,
  guild_id: "111",
  event_id: 7,
  best_of: 3,
};

function fakePool(mecz = MECZ) {
  const wywolania = [];

  return {
    wywolania,

    async query(sql, params) {
      wywolania.push({ sql: String(sql), params });

      if (String(sql).includes("FROM matches")) return [[mecz], []];

      return [{ affectedRows: 1 }, []];
    },
  };
}

async function trasa(pool, { transakcje } = {}) {
  const { registerMatchOpsRoutes } = await import("../server/routes/matchOps.js");

  const app = fakeApp();

  const podane = {
    pool,
    io: { emit: () => {} },
    logInfo: () => {},
    logWarn: () => {},
    logError: () => {},
    requireGuildAdmin: () => (req, res, next) => next(),
    guildIdFromMatchId: async () => "111",

    async runInTransaction(_pula, fn) {
      transakcje?.push("start");

      const wynik = await fn(pool);

      transakcje?.push("commit");

      return wynik;
    },
  };

  // Czterdziesci kilka zaleznosci, z ktorych ta trasa uzywa kilku.
  const zaleznosci = new Proxy(podane, {
    get(cel, nazwa) {
      if (nazwa in cel) return cel[nazwa];

      return () => {};
    },
    has: () => true,
  });

  registerMatchOpsRoutes(app, zaleznosci);

  const handler = app.trasy.get("PUT /api/matches/:matchId/maps");

  assert.ok(handler, "trasa zapisu map musi byc zarejestrowana");

  return handler;
}

function zadanie(maps) {
  return { params: { matchId: "5" }, body: { maps }, session: {} };
}

/** Zapytania wstawiajace mapy. */
function wstawienia(pool) {
  return pool.wywolania.filter((w) => /INSERT INTO match_maps/i.test(w.sql));
}

test("zapisuje komplet map BO3 z wyliczonym pickerem", async () => {
  const pool = fakePool();
  const handler = await trasa(pool);
  const res = fakeRes();

  await handler(zadanie(["de_mirage", "Nuke", "inferno"]), res);

  assert.equal(res.zapis.kod, 200);

  const wiersze = wstawienia(pool);

  assert.equal(wiersze.length, 3);

  // guild_id, event_id, match_id, map_no, map_name, picked_by, source
  assert.deepEqual(wiersze[0].params, ["111", 7, 5, 1, "Mirage", "TEAM_A", "manual"]);
  assert.deepEqual(wiersze[1].params, ["111", 7, 5, 2, "Nuke", "TEAM_B", "manual"]);
  assert.deepEqual(wiersze[2].params, ["111", 7, 5, 3, "Inferno", "DECIDER", "manual"]);
});

test("PODMIENIA komplet, a nie dopisuje", async () => {
  // Panel pokazuje komplet map serii i wysyla komplet, wiec to, czego
  // administrator nie podal, ma zniknac. Bez kasowania skasowanie pomylki
  // wymagaloby osobnego przycisku.
  const pool = fakePool();
  const handler = await trasa(pool);

  await handler(zadanie(["Mirage"]), fakeRes());

  const kasowanie = pool.wywolania.filter((w) =>
    /DELETE FROM match_maps/i.test(w.sql),
  );

  assert.equal(kasowanie.length, 1, "brak kasowania starych map");
  assert.deepEqual(kasowanie[0].params, [5]);
});

test("kasowanie i wstawianie ida JEDNA transakcja", async () => {
  // Inaczej nieudane wstawienie zostawiloby mecz bez map, ktore mial.
  const transakcje = [];
  const pool = fakePool();
  const handler = await trasa(pool, { transakcje });

  await handler(zadanie(["Mirage", "Nuke", "Ancient"]), fakeRes());

  assert.deepEqual(transakcje, ["start", "commit"]);
});

test("ZLY FORMAT SERII nie dotyka bazy", async () => {
  const pool = fakePool({ ...MECZ, best_of: 2 });
  const handler = await trasa(pool);
  const res = fakeRes();

  await handler(zadanie(["Mirage", "Nuke"]), res);

  assert.equal(res.zapis.kod, 400);
  assert.equal(res.zapis.tresc.code, "server.badBestOf");
  assert.equal(wstawienia(pool).length, 0);
});

test("wiecej map niz pozwala format jest odrzucane", async () => {
  const pool = fakePool();
  const handler = await trasa(pool);
  const res = fakeRes();

  await handler(zadanie(["Mirage", "Nuke", "Ancient", "Train"]), res);

  assert.equal(res.zapis.kod, 400);
  assert.equal(res.zapis.tresc.code, "server.tooManyMaps");
  assert.equal(
    wstawienia(pool).length,
    0,
    "nic nie moze trafic do bazy przy odrzuconym wejsciu",
  );
});

test("nieznana mapa PRZECHODZI, ale jest zgloszona", async () => {
  // Pula map zmienia sie co kilka miesiecy, wiec nieznana nazwa nie moze
  // blokowac zapisu. Najczesciej jest jednak literowka - panel ma o tym
  // powiedziec.
  const pool = fakePool();
  const handler = await trasa(pool);
  const res = fakeRes();

  await handler(zadanie(["Mirage", "Agency", "Nuke"]), res);

  assert.equal(res.zapis.kod, 200);
  assert.deepEqual(res.zapis.tresc.unknown, ["Agency"]);
  assert.equal(wstawienia(pool).length, 3);
});

test("czesciowe veto zapisuje tylko to, co znane", async () => {
  const pool = fakePool();
  const handler = await trasa(pool);
  const res = fakeRes();

  await handler(zadanie(["Mirage", "", null]), res);

  assert.equal(res.zapis.kod, 200);

  const wiersze = wstawienia(pool);

  assert.equal(wiersze.length, 1);
  assert.equal(wiersze[0].params[3], 1, "numer mapy");
});

test("nieistniejacy mecz konczy sie 404, a nie zapisem", async () => {
  const pool = fakePool(undefined);

  pool.query = async (sql, params) => {
    pool.wywolania.push({ sql: String(sql), params });

    if (String(sql).includes("FROM matches")) return [[], []];

    return [{ affectedRows: 0 }, []];
  };

  const handler = await trasa(pool);
  const res = fakeRes();

  await handler(zadanie(["Mirage"]), res);

  assert.equal(res.zapis.kod, 404);
  assert.equal(wstawienia(pool).length, 0);
});

test("zrodlem jest ZAWSZE 'manual' - te droga idzie czlowiek", async () => {
  // Skrypt dociagajacy dane pisze 'liquipedia' i NIE nadpisuje wierszy
  // recznych. Gdyby ta trasa zapisywala cudze zrodlo, automat zaczalby
  // kasowac wpisy administratora.
  const pool = fakePool();
  const handler = await trasa(pool);

  await handler(zadanie(["Mirage", "Nuke", "Ancient"]), fakeRes());

  for (const w of wstawienia(pool)) {
    assert.equal(w.params[6], "manual");
  }
});
