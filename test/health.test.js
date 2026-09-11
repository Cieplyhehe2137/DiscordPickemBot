// Healthcheck.
//
// Sens tego endpointu polega na tym, ze ROZROZNIA stan procesu od stanu bazy.
// Serwer z martwa baza nadal odpowiada 200 na wszystko, co MySQL-a nie dotyka,
// wiec bez tego rozroznienia wyglada zdrowo az do pierwszej reklamacji.
//
// Handler wyciagamy przez atrape `app` - to wystarcza, zeby zawolac go z
// wlasnym req/res i nie wymaga dokladania zadnej biblioteki do testow.

const test = require("node:test");
const assert = require("node:assert/strict");

const HEALTH = "../server/routes/health.js";

function fakeRes() {
  const zapis = { kod: 200, tresc: null };

  return {
    zapis,
    status(kod) {
      zapis.kod = kod;
      return this;
    },
    json(tresc) {
      zapis.tresc = tresc;
      return this;
    },
  };
}

// Rejestruje trasy na atrapie app i oddaje sam handler.
async function handler(pool) {
  const { registerHealthRoutes } = await import(HEALTH);

  let zlapany = null;

  registerHealthRoutes(
    {
      get(sciezka, fn) {
        assert.equal(sciezka, "/api/health");
        zlapany = fn;
      },
    },
    { pool },
  );

  assert.ok(zlapany, "trasa nie zostala zarejestrowana");
  return zlapany;
}

test("zdrowa baza daje status ok", async () => {
  let zapytanie = null;

  const fn = await handler({
    async query(sql) {
      zapytanie = sql;
      return [[{ 1: 1 }]];
    },
  });

  const res = fakeRes();
  await fn({}, res);

  assert.equal(res.zapis.kod, 200, "domyslny kod, nic nie odrzucone");
  assert.equal(res.zapis.tresc.status, "ok");
  assert.equal(res.zapis.tresc.db, "ok");
  assert.equal(zapytanie, "SELECT 1", "najtansze mozliwe zapytanie");
});

test("padnieta baza daje 503, a nie 200", async () => {
  const oryginalny = console.error;
  console.error = () => {};

  try {
    const fn = await handler({
      async query() {
        throw new Error("ECONNREFUSED 10.0.0.5:3306 user=pickem db=s25345_pickemdb");
      },
    });

    const res = fakeRes();
    await fn({}, res);

    // Na kod odpowiedzi patrza automaty - PM2, monitor, load balancer.
    assert.equal(res.zapis.kod, 503);
    assert.equal(res.zapis.tresc.status, "degraded");
    assert.equal(res.zapis.tresc.db, "error");
  } finally {
    console.error = oryginalny;
  }
});

test("komunikat bledu bazy nie wycieka do odpowiedzi", async () => {
  const oryginalny = console.error;
  console.error = () => {};

  try {
    const fn = await handler({
      async query() {
        throw new Error("ECONNREFUSED 10.0.0.5:3306 user=pickem db=s25345_pickemdb");
      },
    });

    const res = fakeRes();
    await fn({}, res);

    // Endpoint jest publiczny, a bledy mysql2 niosa host, uzytkownika i nazwe
    // bazy - nie moga trafic do tresci odpowiedzi.
    const tresc = JSON.stringify(res.zapis.tresc);

    for (const tajne of ["ECONNREFUSED", "10.0.0.5", "pickem", "3306"]) {
      assert.ok(!tresc.includes(tajne), `wyciek: ${tajne} w ${tresc}`);
    }
  } finally {
    console.error = oryginalny;
  }
});

test("odpowiedz niesie czas dzialania i czas odpowiedzi bazy", async () => {
  const fn = await handler({ async query() { return [[]]; } });

  const res = fakeRes();
  await fn({}, res);

  assert.equal(typeof res.zapis.tresc.uptimeSec, "number");
  assert.ok(res.zapis.tresc.uptimeSec >= 0);
  assert.equal(typeof res.zapis.tresc.dbLatencyMs, "number");
  assert.ok(res.zapis.tresc.dbLatencyMs >= 0);
});
