// Trasa glosowania na MVP (server/routes/mvp.js).
//
// Atrapa puli - nic nie laczy sie z baza. Cala trudnosc tej trasy jest
// w JEDNYM zapytaniu: kandydaci, liczba glosow i wskazanie zwyciezcy maja
// przyjsc razem. Osobne zapytania byly by trzema podrozami do bazy po dane,
// z ktorych zadne nie zalezy od pozostalych.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/mvp.js";

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

const KANDYDACI = [
  { candidate_id: 1, nickname: "donk", team_name: "Spirit", votes: 40, is_winner: 0 },
  { candidate_id: 2, nickname: "ZywOo", team_name: "Vitality", votes: 36, is_winner: 0 },
  { candidate_id: 4, nickname: "m0NESY", team_name: "Falcons", votes: 3, is_winner: 1 },
];

async function zbuduj(pool) {
  const { registerMvpRoutes } = await import(MODUL);

  const app = fakeApp();

  registerMvpRoutes(app, { pool });

  const handler = app.trasy.get("GET /api/public/events/:slug/mvp");

  assert.ok(handler, "trasa musi byc zarejestrowana");

  return handler;
}

function req(slug = "iem-cologne-major-2026") {
  return { params: { slug } };
}

test("cale glosowanie schodzi JEDNYM zapytaniem", async () => {
  let zapytan = 0;

  const pool = {
    async query() {
      zapytan += 1;

      return [KANDYDACI, []];
    },
  };

  const handler = await zbuduj(pool);

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(zapytan, 1, `zapytan: ${zapytan}`);
});

test("odpowiedz niesie zwyciezce i skutecznosc", async () => {
  const handler = await zbuduj({ async query() {
    return [KANDYDACI, []];
  } });

  const res = fakeRes();

  await handler(req(), res);

  const t = res.zapis.tresc;

  assert.equal(t.total_votes, 79);
  assert.equal(t.resolved, true);
  assert.equal(t.winner.nickname, "m0NESY");
  assert.equal(t.hit_rate, 4);

  assert.deepEqual(
    t.candidates.map((k) => k.nickname),
    ["donk", "ZywOo", "m0NESY"],
  );
});

test("turniej bez glosowania oddaje puste podsumowanie, a nie blad", async () => {
  // Nie kazdy turniej ma MVP - administrator musi ustawic kandydatow.
  // To nie jest awaria, tylko brak sekcji na stronie.
  const handler = await zbuduj({ async query() {
    return [[], []];
  } });

  const res = fakeRes();

  await handler(req("turniej-bez-mvp"), res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(res.zapis.tresc.total_votes, 0);
  assert.equal(res.zapis.tresc.resolved, false);
  assert.deepEqual(res.zapis.tresc.candidates, []);
});

test("slug idzie do zapytania jako parametr, a nie w tresci", async () => {
  // Sklejanie sluga z zapytaniem byloby dziura; parametr zamyka temat.
  let parametry = null;

  const handler = await zbuduj({
    async query(sql, params) {
      parametry = params;

      return [KANDYDACI, []];
    },
  });

  await handler(req("jakis-slug"), fakeRes());

  assert.deepEqual(parametry, ["jakis-slug"]);
});

test("zapytanie bierze TYLKO aktualne wskazanie zwyciezcy", async () => {
  // mvp_results trzyma historie: administrator moze poprawic zwyciezce,
  // a stare wiersze zostaja z active = 0. Bez tego warunku kandydat
  // wskazany omylkowo zostawalby zwyciezca na zawsze.
  const fs = require("node:fs");
  const path = require("node:path");

  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "mvp.js"),
    "utf8",
  );

  assert.match(tresc, /LEFT JOIN mvp_results r/);
  assert.match(tresc, /AND r\.active = 1/);
});

test("awaria bazy konczy sie piecsetka", async () => {
  const handler = await zbuduj({
    async query() {
      throw new Error("baza padla");
    },
  });

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.kod, 500);
  assert.equal(res.zapis.tresc.code, "server.mvpVoteFailed");
});
