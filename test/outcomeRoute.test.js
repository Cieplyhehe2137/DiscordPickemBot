// Trasa wyniku turnieju (server/routes/outcome.js).
//
// Atrapa puli - nic nie laczy sie z baza. Test liczy FALE zapytan, bo kazda
// to osobna podroz do bazy stojacej na innej maszynie niz API: zmierzone na
// serwerze 177 ms, niezaleznie od tego, ile wierszy wraca.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/outcome.js";

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

const WYNIK = [
  {
    correct_semifinalists: "FURIA, Aurora, Falcons, Spirit",
    correct_finalists: "FURIA, Falcons",
    correct_winner: "Falcons",
    correct_third_place_winner: "—",
  },
];

const TYPY = [
  { winner: "Falcons", finalists: "Falcons, FURIA", semifinalists: "" },
  { winner: "Spirit", finalists: "Spirit, FURIA", semifinalists: "" },
  { winner: "Spirit", finalists: "Spirit, Aurora", semifinalists: "" },
];

const LOGOTYPY = [{ name_key: "falcons", logo_url: "https://x/falcons.png" }];

function daneDla(sql) {
  if (sql.includes("FROM playoffs_results")) return WYNIK;
  if (sql.includes("FROM playoffs_predictions")) return TYPY;

  return LOGOTYPY;
}

async function zbuduj(pool) {
  const { registerOutcomeRoutes } = await import(MODUL);

  const app = fakeApp();

  registerOutcomeRoutes(app, { pool });

  const handler = app.trasy.get("GET /api/public/events/:slug/outcome");

  assert.ok(handler, "trasa musi byc zarejestrowana");

  return handler;
}

const req = { params: { slug: "iem-cologne-major-2026" } };

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
    3,
    `przed pierwsza odpowiedzia baza powinna dostac wszystkie trzy zapytania, dostala ${rozpoczete}`,
  );

  for (const otworz of bramki) otworz();

  await odpowiedz;
});

test("odpowiedz niesie drabinke i trafnosc", async () => {
  const pool = { async query(sql) { return [daneDla(sql), []]; } };

  const res = fakeRes();

  await (await zbuduj(pool))(req, res);

  const d = res.zapis.tresc;

  assert.equal(res.zapis.kod, 200);
  assert.equal(d.settled, true);
  assert.equal(d.winner.name, "Falcons");
  assert.equal(d.winner.logo, "https://x/falcons.png");
  assert.equal(d.runner_up.name, "FURIA");
  assert.equal(d.total, 3);
  assert.equal(d.called.winner, 1);
  assert.equal(d.favourite.name, "Spirit");
  assert.equal(d.favourite.was_right, false);
});

test("myslnik z bazy nie trafia na strone jako trzecie miejsce", async () => {
  // W danych stoi correct_third_place_winner = "—". Bez odsiania byloby to
  // "druzyna" z litera "—" w kolku herbu.
  const pool = { async query(sql) { return [daneDla(sql), []]; } };

  const res = fakeRes();

  await (await zbuduj(pool))(req, res);

  assert.equal(res.zapis.tresc.third_place, null);
});

test("turniej bez wiersza wynikow oddaje settled: false, a nie blad", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("FROM playoffs_results")) return [[], []];

      return [daneDla(sql), []];
    },
  };

  const res = fakeRes();

  await (await zbuduj(pool))(req, res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(res.zapis.tresc.settled, false);
  assert.equal(res.zapis.tresc.winner, null);
});

test("zapytanie o wynik bierze tylko wiersz AKTYWNY", async () => {
  // Tabela trzyma historie: administrator moze poprawic wynik, a stare
  // wiersze zostaja z active = 0.
  const fs = require("node:fs");
  const path = require("node:path");

  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "outcome.js"),
    "utf8",
  );

  assert.match(tresc, /FROM playoffs_results/);
  assert.match(tresc, /AND active = 1/);
  assert.match(tresc, /ORDER BY id DESC/);
});

test("awaria bazy konczy sie piecsetka, a nie pusta sekcja", async () => {
  const pool = {
    async query() {
      throw new Error("baza padla");
    },
  };

  const res = fakeRes();

  await (await zbuduj(pool))(req, res);

  assert.equal(res.zapis.kod, 500);
  assert.equal(res.zapis.tresc.code, "server.outcomeFailed");
});
