// Trasy licznika odwiedzin.
//
// Atrapa puli i atrapa `app` - nic nie laczy sie z baza ani nie otwiera portu.
// Sprawdzamy to, czego czysty test skrotu nie obejmuje: ze automat nie trafia
// do bazy, ze powtorne wejscie idzie przez INSERT IGNORE zamiast SELECT-a,
// i ze awaria bazy nie psuje strony.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/visits.js";

const UA_PRZEGLADARKI =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36";

// Minimalny `app`: zapamietuje uchwyty, zeby test mogl je wywolac wprost.
function fakeApp() {
  const trasy = new Map();

  return {
    trasy,
    post(sciezka, handler) {
      trasy.set(`POST ${sciezka}`, handler);
    },
    get(sciezka, handler) {
      trasy.set(`GET ${sciezka}`, handler);
    },
  };
}

function fakeReq({ ip = "203.0.113.7", userAgent = UA_PRZEGLADARKI } = {}) {
  return {
    ip,
    get(naglowek) {
      return naglowek.toLowerCase() === "user-agent" ? userAgent : undefined;
    },
  };
}

function fakeRes() {
  const zapis = { kod: 200, tresc: null, zakonczone: false };

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
    end() {
      zapis.zakonczone = true;
      return res;
    },
  };

  return res;
}

function fakePool({ rzuca = false, liczby = [] } = {}) {
  const zapytania = [];
  let wywolan = 0;

  return {
    zapytania,
    async query(sql, params) {
      zapytania.push({ sql: String(sql), params });

      if (rzuca) {
        throw new Error("baza padla");
      }

      const wynik = liczby[wywolan] ?? 0;
      wywolan += 1;

      return [[{ n: wynik }]];
    },
  };
}

async function zbuduj(pool) {
  const { registerVisitRoutes } = await import(MODUL);

  const app = fakeApp();

  registerVisitRoutes(app, { pool, env: { VISIT_SALT: "sekret-testowy" } });

  return app;
}

test("wejscie przegladarki trafia do bazy przez INSERT IGNORE", async () => {
  const pool = fakePool();
  const app = await zbuduj(pool);
  const res = fakeRes();

  await app.trasy.get("POST /api/public/visit")(fakeReq(), res);

  assert.equal(pool.zapytania.length, 1, "oczekiwano jednego zapytania");

  const { sql, params } = pool.zapytania[0];

  // INSERT IGNORE, a nie SELECT + INSERT: klucz (day, visitor_hash) sam
  // odrzuca duplikat, wiec nie ma wyscigu miedzy dwiema kartami naraz.
  assert.match(sql, /INSERT IGNORE INTO site_visits/i);
  assert.equal(params.length, 2);
  assert.match(params[0], /^\d{4}-\d{2}-\d{2}$/, "dzien w formacie DATE");
  assert.equal(params[1].length, 16, "skrot ma 16 bajtow");

  assert.equal(res.zapis.kod, 204);
});

test("automat nie trafia do bazy w ogole", async () => {
  const pool = fakePool();
  const app = await zbuduj(pool);
  const res = fakeRes();

  await app.trasy.get("POST /api/public/visit")(
    fakeReq({ userAgent: "Googlebot/2.1" }),
    res,
  );

  assert.equal(pool.zapytania.length, 0, "crawler zostal zapisany");
  assert.equal(res.zapis.kod, 204, "automat tez dostaje 204, bez tresci");
});

test("awaria bazy nie psuje strony", async () => {
  const pool = fakePool({ rzuca: true });
  const app = await zbuduj(pool);
  const res = fakeRes();

  // Bez rzucania na zewnatrz: Express zamienilby wyjatek na 500, a licznik
  // odwiedzin nie jest powodem, zeby cokolwiek na stronie zglaszalo blad.
  await app.trasy.get("POST /api/public/visit")(fakeReq(), res);

  assert.equal(res.zapis.kod, 204);
});

test("ten sam gosc dwa razy to ten sam skrot", async () => {
  const pool = fakePool();
  const app = await zbuduj(pool);

  const handler = app.trasy.get("POST /api/public/visit");

  await handler(fakeReq(), fakeRes());
  await handler(fakeReq(), fakeRes());

  const [pierwszy, drugi] = pool.zapytania;

  // Dwa zapytania poszly, ale z identycznym kluczem - o odrzucenie duplikatu
  // dba baza, nie kod.
  assert.deepEqual(pierwszy.params[1], drugi.params[1]);
});

test("statystyki oddaja sume i dzisiejszy dzien", async () => {
  const pool = fakePool({ liczby: [1294, 37] });
  const app = await zbuduj(pool);
  const res = fakeRes();

  await app.trasy.get("GET /api/public/visits")(fakeReq(), res);

  assert.deepEqual(res.zapis.tresc, { total: 1294, today: 37 });
});

test("statystyki przy awarii bazy oddaja 503, bez szczegolow", async () => {
  const pool = fakePool({ rzuca: true });
  const app = await zbuduj(pool);
  const res = fakeRes();

  await app.trasy.get("GET /api/public/visits")(fakeReq(), res);

  assert.equal(res.zapis.kod, 503);

  // Komunikat bledu bazy potrafi zawierac host i nazwe bazy, a trasa jest
  // publiczna.
  assert.ok(!JSON.stringify(res.zapis.tresc).includes("baza padla"));
});
