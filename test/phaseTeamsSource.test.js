// Skad formularz fazy bierze liste druzyn (server/routes/publicPickem.js).
//
// Roster druzyn jest wspolny dla calego SERWERA, a nie dla turnieju. Dopoki
// faza jest otwarta, to jedyne mozliwe zrodlo - meczow moze jeszcze nie byc.
// Po zamknieciu jest odwrotnie: mecze sa, a roster zdazyl odjechac.
//
// Na produkcji wyszlo to wprost. Zakonczony IEM Krakow 2026 pokazywal
// wybieraczke z dziesiecioma nazwami w rodzaju "DFGDFGDFGS" i ani jedna
// z dwudziestu czterech druzyn, ktore w nim zagraly - te lezaly caly czas
// w jego meczach. Drugi serwer mial roster PUSTY, wiec ta sama wada
// objawiala sie tam jako wybieraczka bez zadnej opcji.
//
// Atrapa puli i atrapa `app` - nic nie laczy sie z baza.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/publicPickem.js";

const GILDIA = "1221762685595553834";
const EVENT_ID = 88;

// Prawdziwe dane z produkcji, przyciete: roster to same smieci, a druzyny
// turnieju istnieja wylacznie w meczach.
const ROSTER = ["TEST", "QWER", "DFGDFGDFGS", "cvbcbcb"];
const W_MECZACH = ["FURIA", "MOUZ", "Spirit", "Vitality"];

function fakeApp() {
  const trasy = new Map();

  return {
    trasy,
    get(sciezka, handler) {
      trasy.set(`GET ${sciezka}`, handler);
    },
    post() {},
  };
}

function fakePool() {
  const wywolania = [];

  return {
    wywolania,

    query(sql, args) {
      const tekst = String(sql);

      wywolania.push({ sql: tekst, args });

      if (tekst.includes("FROM events")) {
        return Promise.resolve([
          [
            {
              id: EVENT_ID,
              guild_id: GILDIA,
              name: "IEM Krakow 2026",
              slug: "iem-krakow-2026",
              phase: "PLAYOFFS",
              status: "FINISHED",
            },
          ],
          [],
        ]);
      }

      if (tekst.includes("FROM teams")) {
        return Promise.resolve([
          ROSTER.map((name, i) => ({ id: i + 1, name })),
          [],
        ]);
      }

      if (tekst.includes("FROM matches")) {
        return Promise.resolve([W_MECZACH.map((name) => ({ name })), []]);
      }

      return Promise.resolve([[], []]);
    },
  };
}

function fakeRes() {
  const stan = { kod: 200, body: null };

  return {
    stan,
    status(kod) {
      stan.kod = kod;

      return this;
    },
    json(body) {
      stan.body = body;

      return this;
    },
  };
}

async function wywolaj(trasa, { allowed, params = {} }) {
  const { registerPublicPickemRoutes } = await import(MODUL);

  const app = fakeApp();
  const pool = fakePool();

  registerPublicPickemRoutes(app, {
    pool,
    checkPickemGate: async () => ({ allowed, message: null }),
    getPhaseLimits: async () => ({}),
    toWebMessage: (message, domyslny) => message ?? domyslny,
    isGuildMember: () => true,
    parseCsvPick: (v) => String(v || "").split(",").filter(Boolean),
    loadActiveTeams: async () => ROSTER,
  });

  const handler = app.trasy.get(trasa);

  assert.ok(handler, `nie zarejestrowano trasy ${trasa}`);

  const res = fakeRes();

  await handler(
    { params: { slug: "iem-krakow-2026", ...params }, session: {} },
    res,
  );

  return { res, pool };
}

const TRASY = [
  ["playoffs", "GET /api/public/events/:slug/playoffs-pickem", {}],
  ["play-in", "GET /api/public/events/:slug/playin-pickem", {}],
  ["double elim", "GET /api/public/events/:slug/doubleelim-pickem", {}],
  ["swiss", "GET /api/public/events/:slug/swiss-pickem/:stage", { stage: "stage1" }],
];

for (const [nazwa, trasa, params] of TRASY) {

  test(`${nazwa}: otwarta faza bierze roster serwera`, async () => {
    // Przed powstaniem meczow roster jest jedynym zrodlem - to zachowanie
    // ma zostac nietkniete, bo dotyczy turnieju W TRAKCIE.
    const { res, pool } = await wywolaj(trasa, { allowed: true, params });

    assert.deepEqual(
      res.stan.body.teams.map((t) => t.name),
      ROSTER,
    );

    assert.equal(
      pool.wywolania.some((w) => w.sql.includes("FROM matches")),
      false,
      "otwarta faza nie ma po co pytac o mecze - to dodatkowa podroz do bazy",
    );
  });

  test(`${nazwa}: zamknieta faza bierze druzyny turnieju`, async () => {
    const { res, pool } = await wywolaj(trasa, { allowed: false, params });

    assert.deepEqual(
      res.stan.body.teams.map((t) => t.name),
      W_MECZACH,
    );

    assert.equal(
      pool.wywolania.some((w) => w.sql.includes("FROM teams")),
      false,
      "zamknieta faza nie moze siegac po roster serwera",
    );

    // Zapytanie o mecze musi byc zawezone do TEGO turnieju. Bez tego
    // wybieraczka pokazalaby druzyny ze wszystkich turniejow serwera.
    const mecze = pool.wywolania.find((w) => w.sql.includes("FROM matches"));

    assert.deepEqual(mecze.args, [EVENT_ID, EVENT_ID]);
  });
}

test("identyfikatory druzyn sa unikalne, gdy dochodza nazwy z zapisanego typu", async () => {
  // withPickedTeams dokleja nazwy z zapisanego typu z UJEMNYMI id, a lista
  // z meczow dostaje dodatnie. Front uzywa id jako klucza Reacta, wiec dwa
  // zestawy liczone od tej samej strony daly by klucze powtorzone.
  const { registerPublicPickemRoutes } = await import(MODUL);

  const app = fakeApp();

  const pool = {
    query(sql) {
      const tekst = String(sql);

      if (tekst.includes("FROM events")) {
        return Promise.resolve([
          [{ id: EVENT_ID, guild_id: GILDIA, name: "E", slug: "e", status: "FINISHED" }],
          [],
        ]);
      }

      if (tekst.includes("FROM matches")) {
        return Promise.resolve([W_MECZACH.map((name) => ({ name })), []]);
      }

      // Zapisany typ zawiera druzyne, ktorej w meczach NIE MA - dokladnie
      // ten przypadek, dla ktorego withPickedTeams istnieje.
      if (tekst.includes("playoffs_predictions")) {
        return Promise.resolve([
          [
            {
              semifinalists: "FURIA,Astralis",
              finalists: "FURIA",
              winner: "FURIA",
              third_place_winner: null,
            },
          ],
          [],
        ]);
      }

      return Promise.resolve([[], []]);
    },
  };

  registerPublicPickemRoutes(app, {
    pool,
    checkPickemGate: async () => ({ allowed: false, message: null }),
    getPhaseLimits: async () => ({}),
    toWebMessage: (m, d) => m ?? d,
    isGuildMember: () => true,
    parseCsvPick: (v) => String(v || "").split(",").filter(Boolean),
    loadActiveTeams: async () => ROSTER,
  });

  const res = fakeRes();

  await handlerZ(app, "GET /api/public/events/:slug/playoffs-pickem")(
    { params: { slug: "e" }, session: { user: { id: "1" } } },
    res,
  );

  const teams = res.stan.body.teams;
  const id = teams.map((t) => t.id);

  assert.ok(
    teams.some((t) => t.name === "Astralis"),
    "nazwa z zapisanego typu musi trafic na liste",
  );

  assert.equal(new Set(id).size, id.length, `powtorzone id: ${id.join(", ")}`);
});

function handlerZ(app, trasa) {
  const handler = app.trasy.get(trasa);

  assert.ok(handler, `nie zarejestrowano trasy ${trasa}`);

  return handler;
}
