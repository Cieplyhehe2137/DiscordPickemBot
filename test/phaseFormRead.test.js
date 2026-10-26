// ODCZYT formularza fazy - kontrakt trzech tras, ktore sa tym samym kodem.
//
// Play-In, Playoffs i Double Elimination odpowiadaja na GET formularza
// identyczna sciezka: turniej ze sluga, gate, lista druzyn, a dla
// zalogowanego gracza jeszcze czlonkostwo i jego zapisany typ. Rozni je
// wylacznie zapytanie o typ i ksztalt odpowiedzi tego zapytania.
//
// phaseTeamsSource.test.js pokrywa z tego JEDNO: skad bierze sie lista
// druzyn. Caly reszta kontraktu - 404, czlonkostwo przy odczycie, pole
// `lock`, limity, parsowanie zapisanego typu - nie byla pokryta niczym,
// a to jest wlasnie to, co scalanie trzech kopii moze zepsuc.
//
// SWISS JEST TU OSOBNO I TAK MA ZOSTAC. Jego odpowiedz ma inny ksztalt:
// przyciety `event` zamiast calego wiersza, dodatkowe pole `stage` i `lock`
// z kodem tlumaczenia. Ostatni test pilnuje tej roznicy wprost, zeby nie
// zniknela po cichu przy "ujednolicaniu" - zniknelaby razem z nia zmiana
// odpowiedzi API dla czterech ekranow.
//
// Atrapa puli i atrapa `app` - nic nie laczy sie z baza.

const test = require("node:test");
const assert = require("node:assert/strict");

const EVENT_ID = 42;
const GILDIA = "1221762685595553834";

// Roster serwera. "Z" go NIE zawiera - a stoi w zapisanym typie, zeby
// sprawdzic, ze nazwy z typu nadal dochodza do listy jako nieaktywne.
const ROSTER = ["A", "B"];

const SESJA = { user: { id: "77", username: "gracz" } };

const WIERSZ_EVENTU = {
  id: EVENT_ID,
  guild_id: GILDIA,
  name: "IEM Krakow 2026",
  slug: "iem-krakow-2026",
  status: "RUNNING",
};

const FAZY = [
  {
    nazwa: "Play-In",
    modul: "../server/routes/publicPickemPlayin.js",
    rejestrator: "registerPublicPickemPlayinRoutes",
    sciezka: "/api/public/events/:slug/playin-pickem",
    gate: "PLAYIN",
    limity: "playin",
    tabela: "playin_predictions",
    wiersz: { teams: "A, Z" },
    typ: { teams: ["A", "Z"] },
  },
  {
    nazwa: "Playoffs",
    modul: "../server/routes/publicPickemPlayoffs.js",
    rejestrator: "registerPublicPickemPlayoffsRoutes",
    sciezka: "/api/public/events/:slug/playoffs-pickem",
    gate: "PLAYOFFS",
    limity: "playoffs",
    tabela: "playoffs_predictions",
    wiersz: {
      semifinalists: "A, B, Z",
      finalists: "A, B",
      winner: "A",
      third_place_winner: "Z",
    },
    typ: {
      semifinalists: ["A", "B", "Z"],
      finalists: ["A", "B"],
      winner: "A",
      third_place_winner: "Z",
    },
  },
  {
    nazwa: "Double Elimination",
    modul: "../server/routes/publicPickemDoubleElim.js",
    rejestrator: "registerPublicPickemDoubleElimRoutes",
    sciezka: "/api/public/events/:slug/doubleelim-pickem",
    gate: "DOUBLEELIM",
    limity: "doubleelim",
    tabela: "doubleelim_predictions",
    wiersz: {
      upper_final_a: "A, B",
      lower_final_a: "A, Z",
      upper_final_b: "B, A",
      lower_final_b: "A, B",
    },
    typ: {
      upper_final_a: ["A", "B"],
      lower_final_a: ["A", "Z"],
      upper_final_b: ["B", "A"],
      lower_final_b: ["A", "B"],
    },
  },
];

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

function fakePool({ brakEventu = false, wiersz = null, tabela = "" } = {}) {
  const zapytania = [];

  return {
    zapytania,

    get zapytaloOTyp() {
      return zapytania.some((q) => tabela && q.sql.includes(tabela));
    },

    query(sql, args) {
      const tekst = String(sql);

      zapytania.push({ sql: tekst, args });

      if (/FROM events/i.test(tekst)) {
        return Promise.resolve([[brakEventu ? undefined : WIERSZ_EVENTU], []]);
      }

      if (tabela && tekst.includes(tabela)) {
        return Promise.resolve([[wiersz || undefined], []]);
      }

      if (/FROM teams/i.test(tekst)) {
        return Promise.resolve([
          ROSTER.map((name, i) => ({ id: i + 1, name })),
          [],
        ]);
      }

      return Promise.resolve([[], []]);
    },
  };
}

async function wczytaj(faza, { nadpisz = {}, sesja = SESJA, pool } = {}) {
  const modul = await import(faza.modul);

  const app = fakeApp();

  const uzytaPula =
    pool || fakePool({ wiersz: faza.wiersz, tabela: faza.tabela });

  const wywolania = { gate: [], limity: [], czlonkostwo: 0 };

  modul[faza.rejestrator](app, {
    pool: uzytaPula,

    isGuildMember: () => {
      wywolania.czlonkostwo += 1;

      return true;
    },

    checkPickemGate: async (guildId, kind, stage) => {
      wywolania.gate.push({ guildId, kind, stage });

      return { allowed: true, message: null, deadline: null };
    },

    getPhaseLimits: async (_pool, guildId, eventId, phase) => {
      wywolania.limity.push({ guildId, eventId, phase });

      return { teams: 6 };
    },

    getOpenEventId: async () => EVENT_ID,
    loadActiveTeams: async () => ROSTER,
    sprawdzTyp: () => ({ ok: true }),

    toWebMessage: (message, domyslne) => message ?? domyslne,

    parseCsvPick: (v) =>
      String(v || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),

    ...nadpisz,
  });

  const handler = app.trasy.get(`GET ${faza.sciezka}`);

  assert.ok(handler, `${faza.nazwa}: nie zarejestrowano trasy GET`);

  const res = fakeRes();

  await handler(
    { params: { slug: "iem-krakow-2026" }, session: sesja },
    res,
  );

  return { res, pool: uzytaPula, wywolania };
}

for (const faza of FAZY) {
  test(`${faza.nazwa}: nieznany turniej to 404`, async () => {
    const { res } = await wczytaj(faza, {
      pool: fakePool({ brakEventu: true, tabela: faza.tabela }),
    });

    assert.equal(res.stan.kod, 404);
    assert.equal(res.stan.body.code, "server.eventNotFound");
  });

  test(`${faza.nazwa}: niezalogowany widzi formularz bez typu`, async () => {
    // Formularz jest publiczny - to strona, ktora ludzie wrzucaja linkiem.
    // Bez sesji nie ma czego sprawdzac ani czyjego typu czytac.
    const { res, pool, wywolania } = await wczytaj(faza, { sesja: {} });

    assert.equal(res.stan.kod, 200, JSON.stringify(res.stan.body));
    assert.equal(res.stan.body.prediction, null);
    assert.equal(wywolania.czlonkostwo, 0, "bez sesji nie ma kogo sprawdzac");
    assert.equal(pool.zapytaloOTyp, false, "bez sesji nie ma czyjego typu czytac");
  });

  test(`${faza.nazwa}: zalogowany spoza serwera dostaje 403`, async () => {
    // Te trzy trasy jako jedyne pozwalaly odpytac turniej obcego serwera.
    const { res } = await wczytaj(faza, {
      nadpisz: { isGuildMember: () => false },
    });

    assert.equal(res.stan.kod, 403);
    assert.equal(res.stan.body.code, "server.notMember");
  });

  test(`${faza.nazwa}: zapisany typ wraca rozlozony na listy`, async () => {
    const { res } = await wczytaj(faza);

    assert.equal(res.stan.kod, 200, JSON.stringify(res.stan.body));
    assert.deepEqual(res.stan.body.prediction, faza.typ);
  });

  test(`${faza.nazwa}: druzyna z typu poza rosterem dochodzi do listy`, async () => {
    // "Z" nie stoi w rosterze, ale stoi w zapisanym typie. Bez tego gracz
    // ogladalby wlasny typ jako pusty.
    const { res } = await wczytaj(faza);

    const z = res.stan.body.teams.find((t) => t.name === "Z");

    assert.ok(z, "nazwa z zapisanego typu musi trafic na liste");
    assert.equal(z.active, false, "dolozona nazwa ma byc nieaktywna");

    const id = res.stan.body.teams.map((t) => t.id);

    assert.equal(new Set(id).size, id.length, `powtorzone id: ${id.join(", ")}`);
  });

  test(`${faza.nazwa}: pyta o SWOJ gate i SWOJE limity`, async () => {
    const { wywolania } = await wczytaj(faza);

    assert.equal(wywolania.gate.length, 1);
    assert.equal(wywolania.gate[0].kind, faza.gate);
    assert.equal(wywolania.gate[0].guildId, GILDIA);

    assert.equal(wywolania.limity.length, 1);
    assert.equal(wywolania.limity[0].phase, faza.limity);
    assert.equal(wywolania.limity[0].eventId, EVENT_ID);
  });

  test(`${faza.nazwa}: odpowiedz niesie caly wiersz turnieju`, async () => {
    // Front czyta z tego nazwe i stan turnieju, a nie tylko id.
    const { res } = await wczytaj(faza);

    assert.deepEqual(res.stan.body.event, WIERSZ_EVENTU);
    assert.deepEqual(res.stan.body.limity, { teams: 6 });
  });

  test(`${faza.nazwa}: zamkniete typowanie w polu lock, BEZ kodu`, async () => {
    const powod = "Zamykam o 18:00.";

    const { res } = await wczytaj(faza, {
      nadpisz: {
        checkPickemGate: async () => ({
          allowed: false,
          message: powod,
          deadline: "2026-10-01T18:00:00Z",
        }),
      },
    });

    assert.equal(res.stan.kod, 200);
    assert.deepEqual(res.stan.body.lock, {
      allowed: false,
      message: powod,
      deadline: "2026-10-01T18:00:00Z",
    });

    // Brak `code` to ROZJAZD wzgledem Swiss, nie zamysl - ale zmiana tego
    // zmienia odpowiedz API trzech tras, wiec zostaje do decyzji.
    assert.equal(
      "code" in res.stan.body.lock,
      false,
      "te trzy fazy nie podaja kodu blokady - Swiss podaje",
    );
  });

  test(`${faza.nazwa}: brak powodu od administratora daje message null`, async () => {
    const { res } = await wczytaj(faza, {
      nadpisz: {
        checkPickemGate: async () => ({ allowed: false, message: null }),
      },
    });

    assert.deepEqual(res.stan.body.lock, {
      allowed: false,
      message: null,
      deadline: null,
    });
  });
}

test("Swiss odpowiada INACZEJ i tak ma zostac", async () => {
  // Dowod, dlaczego Swiss nie wchodzi do wspolnej sciezki odczytu. Gdyby
  // ktos go tam wciagnal, zmienilby odpowiedz API czterech ekranow naraz.
  const modul = await import("../server/routes/publicPickemSwiss.js");

  const app = fakeApp();

  const pool = fakePool({ wiersz: null, tabela: "swiss_predictions" });

  modul.registerPublicPickemSwissRoutes(app, {
    pool,
    isGuildMember: () => true,
    checkPickemGate: async () => ({ allowed: false, message: null }),
    getPhaseLimits: async () => ({}),
    getOpenEventId: async () => EVENT_ID,
    loadActiveTeams: async () => ROSTER,
    sprawdzTyp: () => ({ ok: true }),
    toWebMessage: (m, d) => m ?? d,
    parseCsvPick: (v) => String(v || "").split(",").filter(Boolean),
  });

  const handler = app.trasy.get("GET /api/public/events/:slug/swiss-pickem/:stage");

  const res = fakeRes();

  await handler(
    { params: { slug: "iem-krakow-2026", stage: "stage1" }, session: {} },
    res,
  );

  assert.equal(res.stan.kod, 200, JSON.stringify(res.stan.body));

  // 1. `event` przyciety do trzech pol, nie caly wiersz.
  assert.deepEqual(Object.keys(res.stan.body.event).sort(), ["id", "name", "slug"]);

  // 2. Dodatkowe pole, ktorego pozostale fazy nie maja - Swiss ma etapy.
  assert.equal(res.stan.body.stage, "stage1");

  // 3. Blokada ze zdaniem zapasowym I kodem tlumaczenia.
  assert.equal(res.stan.body.lock.allowed, false);
  assert.ok(res.stan.body.lock.message, "Swiss podaje zdanie zapasowe");
  assert.equal(res.stan.body.lock.code, "server.lock.phaseClosed");
});
