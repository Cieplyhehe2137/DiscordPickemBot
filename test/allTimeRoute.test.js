// Trasa klasyfikacji wszech czasow (server/routes/allTime.js).
//
// Atrapa puli - nic nie laczy sie z baza. Test liczy ZAPYTANIA, bo kazde to
// osobna podroz do bazy stojacej na innej maszynie niz API: zmierzone na
// serwerze 177 ms, niezaleznie od tego, ile wierszy wraca. Milisekundy na
// cudzej maszynie nic nie znacza, liczba podrozy znaczy wszystko.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/allTime.js";

function fakeApp() {
  const trasy = new Map();

  return {
    trasy,
    get(sciezka, handler) {
      trasy.set(`GET ${sciezka}`, handler);
    },
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
  };

  return res;
}

// Dwaj gracze po dwa starty i jeden jednorazowy - tyle wystarczy, zeby
// zobaczyc i kolejnosc, i prog.
function wiersze() {
  const w = (user_id, event_id, rank, points) => ({
    user_id,
    event_id,
    name: `Turniej ${event_id}`,
    slug: `turniej-${event_id}`,
    rank_position: rank,
    uczestnicy: 100,
    total_points: points,
    displayname: user_id,
    avatar: null,
  });

  return [
    w("dobry", 1, 5, 40),
    w("dobry", 2, 7, 45),
    w("sredni", 1, 30, 300),
    w("sredni", 2, 40, 310),
    w("jednorazowy", 1, 1, 200),
  ];
}

async function zbuduj(pool) {
  const { registerAllTimeRoutes } = await import(MODUL);

  const app = fakeApp();

  registerAllTimeRoutes(app, { pool });

  const handler = app.trasy.get("GET /api/public/all-time");

  assert.ok(handler, "trasa musi byc zarejestrowana");

  return handler;
}

test("cala tabela powstaje z JEDNEGO zapytania", async () => {
  // Klasyfikacja obejmuje wszystkie turnieje naraz. Gdyby ktos rozbil to na
  // zapytanie per turniej, koszt rosnie z kazdym kolejnym eventem - a tabela
  // wszech czasow z natury obejmuje ich coraz wiecej.
  let zapytan = 0;

  const pool = {
    async query() {
      zapytan += 1;

      return [wiersze(), []];
    },
  };

  const handler = await zbuduj(pool);

  const res = fakeRes();

  await handler({}, res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(zapytan, 1, `zapytan: ${zapytan}`);
});

test("drugie wejscie nie dotyka bazy", async () => {
  let zapytan = 0;

  const pool = {
    async query() {
      zapytan += 1;

      return [wiersze(), []];
    },
  };

  const handler = await zbuduj(pool);

  await handler({}, fakeRes());
  await handler({}, fakeRes());

  assert.equal(zapytan, 1, "druga odpowiedz ma isc z pamieci podrecznej");
});

test("piecdziesiat rownoczesnych wejsc to JEDNO przeliczenie", async () => {
  // To jest chwila, w ktorej ta pamiec ma znaczenie: zaraz po zakonczeniu
  // turnieju wszyscy wchodza zobaczyc, jak zmienila sie tabela.
  let zapytan = 0;

  const pool = {
    async query() {
      zapytan += 1;

      await new Promise((r) => setTimeout(r, 10));

      return [wiersze(), []];
    },
  };

  const handler = await zbuduj(pool);

  await Promise.all(
    Array.from({ length: 50 }, () => handler({}, fakeRes())),
  );

  assert.equal(zapytan, 1, `przeliczen: ${zapytan}`);
});

test("odpowiedz niesie prog startow, a nie tylko liste", async () => {
  // Strona ma powiedziec wprost, czego brakuje komus, kogo w tabeli nie ma.
  // Prog zaszyty w widoku rozjechalby sie z tym, co robi serwer.
  const pool = { async query() {
    return [wiersze(), []];
  } };

  const handler = await zbuduj(pool);

  const res = fakeRes();

  await handler({}, res);

  assert.equal(res.zapis.tresc.min_starts, 2);
});

test("jednorazowy gracz nie trafia do odpowiedzi", async () => {
  const pool = { async query() {
    return [wiersze(), []];
  } };

  const handler = await zbuduj(pool);

  const res = fakeRes();

  await handler({}, res);

  const id = res.zapis.tresc.classification.map((g) => g.user_id);

  assert.deepEqual(id, ["dobry", "sredni"]);
});

test("awaria bazy konczy sie piecsetka, a nie pusta tabela", async () => {
  // Pusta tabela wyglada jak "nikt jeszcze nie zagral" i nie zglasza sie
  // sama. Piecsetka trafia do logow i na ekran.
  const pool = {
    async query() {
      throw new Error("baza padla");
    },
  };

  const handler = await zbuduj(pool);

  const res = fakeRes();

  await handler({}, res);

  assert.equal(res.zapis.kod, 500);
  assert.ok(res.zapis.tresc.error);
  assert.equal(res.zapis.tresc.code, "server.allTimeFailed");
});

test("zapytanie liczy miejsca tym samym wzorem, co profil gracza", async () => {
  // Rozjazd tych dwoch wzorow dalby graczowi inne "TOP x%" na profilu niz
  // to, ktore stoi za jego miejscem w klasyfikacji.
  const fs = require("node:fs");
  const path = require("node:path");

  const sql = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "allTime.js"),
    "utf8",
  );

  assert.match(sql, /ROW_NUMBER\(\) OVER \(/);
  assert.match(sql, /PARTITION BY event_id/);
  assert.match(sql, /COUNT\(\*\) OVER \(PARTITION BY event_id\)/);

  assert.match(
    sql,
    /ORDER BY\s+COALESCE\(total_points, 0\) DESC,\s+user_id ASC/,
    "kolejnosc przy remisie musi byc ta sama, co w profilu gracza",
  );
});
