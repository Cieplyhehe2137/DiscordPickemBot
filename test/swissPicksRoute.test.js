// Trasa typow na fazy Swiss (server/routes/swissPicks.js).
//
// Atrapa puli - nic nie laczy sie z baza. Test liczy FALE zapytan, bo kazda
// to osobna podroz do bazy stojacej na innej maszynie niz API: zmierzone na
// serwerze 177 ms, niezaleznie od tego, ile wierszy wraca.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/swissPicks.js";

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

const EVENT = [{ id: 37, name: "IEM Cologne Major 2026", slug: "cologne" }];

const TYPY = [
  ...Array.from({ length: 8 }, () => ({
    stage: "stage1",
    pick_3_0: "GamerLegion",
    pick_0_3: "SINNERS",
    advancing: "B8, MIBR",
  })),
  ...Array.from({ length: 2 }, () => ({
    stage: "stage1",
    pick_3_0: "BetBoom",
    pick_0_3: "Sharks",
    advancing: "MIBR",
  })),
];

const WYNIKI = [
  {
    stage: "stage1",
    correct_3_0: "BetBoom",
    correct_0_3: "SINNERS",
    correct_advancing: "MIBR",
  },
];

const LOGOTYPY = [{ name_key: "mibr", logo_url: "https://x/mibr.png" }];

function daneDla(sql) {
  if (sql.includes("FROM swiss_predictions")) return TYPY;
  if (sql.includes("FROM swiss_results")) return WYNIKI;

  // Dopiero teraz - zapytania wyzej TEZ zawieraja "FROM events", bo sluga
  // zamieniaja na event_id podzapytaniem.
  if (sql.includes("SELECT id, name, slug")) return EVENT;

  return LOGOTYPY;
}

async function zbuduj(pool) {
  const { registerSwissPicksRoutes } = await import(MODUL);

  const app = fakeApp();

  registerSwissPicksRoutes(app, { pool });

  const handler = app.trasy.get("GET /api/public/events/:slug/swiss-picks");

  assert.ok(handler, "trasa musi byc zarejestrowana");

  return handler;
}

const req = { params: { slug: "cologne" } };

const zwyklaPula = {
  async query(sql) {
    return [daneDla(sql), []];
  },
};

test("wszystkie zapytania ida JEDNA fala", async () => {
  let rozpoczete = 0;

  const bramki = [];

  const pool = {
    query(sql) {
      rozpoczete += 1;

      return new Promise((resolve) => {
        bramki.push(() => resolve([daneDla(sql), []]));
      });
    },
  };

  const handler = await zbuduj(pool);

  const odpowiedz = handler(req, fakeRes());

  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  assert.equal(
    rozpoczete,
    4,
    `przed pierwsza odpowiedzia baza powinna dostac wszystkie cztery zapytania, dostala ${rozpoczete}`,
  );

  for (const otworz of bramki) otworz();

  await odpowiedz;
});

test("odpowiedz niesie etapy, trafienia i przereklamowanych", async () => {
  const res = fakeRes();

  await (await zbuduj(zwyklaPula))(req, res);

  const d = res.zapis.tresc;

  assert.equal(res.zapis.kod, 200);
  assert.equal(d.event.name, "IEM Cologne Major 2026");
  assert.equal(d.stages.length, 1);
  assert.equal(d.stages[0].total, 10);
  assert.equal(d.stages[0].settled, true);

  const trzyZero = d.stages[0].groups.find((g) => g.kind === "three_zero");

  // 8 z 10 na GamerLegion, ktora nie poszla 3-0.
  assert.equal(trzyZero.overrated.name, "GamerLegion");
  assert.equal(trzyZero.overrated.percent, 80);

  const awans = d.stages[0].groups.find((g) => g.kind === "advancing");

  assert.equal(awans.teams.find((t) => t.name === "MIBR").correct, true);
  assert.equal(awans.teams.find((t) => t.name === "MIBR").logo, "https://x/mibr.png");
});

test("nieznany turniej to czterysta cztery, a nie pusta lista etapow", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT id, name, slug")) return [[], []];

      return [daneDla(sql), []];
    },
  };

  const res = fakeRes();

  await (await zbuduj(pool))({ params: { slug: "nie-ma" } }, res);

  assert.equal(res.zapis.kod, 404);
  assert.equal(res.zapis.tresc.code, "server.eventNotFound");
});

test("turniej bez faz Swiss oddaje pusta liste, a nie blad", async () => {
  // IEM Krakow 2026 gral play-in i double elim - Swiss tam nie bylo.
  const pool = {
    async query(sql) {
      if (sql.includes("FROM swiss_predictions")) return [[], []];
      if (sql.includes("FROM swiss_results")) return [[], []];

      return [daneDla(sql), []];
    },
  };

  const res = fakeRes();

  await (await zbuduj(pool))(req, res);

  assert.equal(res.zapis.kod, 200);
  assert.deepEqual(res.zapis.tresc.stages, []);
});

test("oba zapytania biora tylko wiersze AKTYWNE", async () => {
  // Do niedawna ten warunek ukrywal caly IEM Cologne Major 2026 - import
  // wstawil tam wiersze z DEFAULT-em 0, co naprawily migracje 0010 i 0011.
  const fs = require("node:fs");
  const path = require("node:path");

  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "swissPicks.js"),
    "utf8",
  );

  const aktywne = tresc.match(/AND active = 1/g) ?? [];

  assert.equal(aktywne.length, 2, "typy i wyniki, po jednym warunku na kazde");
});

test("awaria bazy konczy sie piecsetka, a nie pusta strona", async () => {
  const pool = {
    async query() {
      throw new Error("baza padla");
    },
  };

  const res = fakeRes();

  await (await zbuduj(pool))(req, res);

  assert.equal(res.zapis.kod, 500);
  assert.equal(res.zapis.tresc.code, "server.swissPicksFailed");
});
