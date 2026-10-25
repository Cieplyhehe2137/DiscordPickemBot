// ZAPIS typu fazy przez WWW - kontrakt wszystkich czterech formularzy.
//
// Swiss, Play-In, Playoffs i Double Elimination maja osobne trasy POST, ale
// droga do zapisu jest w nich ta sama: logowanie, turniej ze sluga,
// czlonkostwo w serwerze, gate typowania, aktualny event i kontrola
// nieaktualnego formularza. Stalo to w czterech kopiach i nie bylo pokryte
// NICZYM - phaseTeamsSource.test.js sprawdza tylko ODCZYT formularzy.
//
// Dlatego ten plik powstal przed scaleniem tych kopii, a nie po. Kazdy
// przypadek leci przez wszystkie cztery fazy, bo po scaleniu pomylka nie
// dotyczylaby jednej trasy, tylko wszystkich naraz.
//
// Najwazniejsze sa trzy rzeczy, ktorych nie widac w typach:
//
//   1. Kazda faza pyta o SWOJ gate. Podmiana nazwy fazy przy scalaniu
//      otworzylaby typowanie Play-In, gdy otwarty jest tylko Playoffs,
//      i nic by tego nie zglosilo.
//   2. Zapis idzie na AKTUALNY event, a nie na ten ze sluga w adresie.
//      Bez tego dalo sie wejsc pod slugiem starego turnieju i zapisac typ
//      do cudzego event_id - to byl prawdziwy blad, naprawiony w Swiss.
//   3. Odrzucenie nie moze zostawic po sobie zapisu. Kazdy przypadek
//      sprawdza, ze do bazy nie poszedl zaden INSERT.
//
// Atrapa puli i atrapa `app` - nic nie laczy sie z baza.

const test = require("node:test");
const assert = require("node:assert/strict");

const EVENT_ID = 42;
const GILDIA = "1221762685595553834";

const SESJA = {
  user: { id: "77", username: "gracz", global_name: "Gracz" },
};

// Cztery fazy i wszystko, co je od siebie rozni. Przypadki nizej nie wiedza
// o zadnej fazie - chodza po tej tablicy.
const FAZY = [
  {
    nazwa: "Swiss",
    modul: "../server/routes/publicPickemSwiss.js",
    rejestrator: "registerPublicPickemSwissRoutes",
    sciezka: "/api/public/events/:slug/swiss-pickem/:stage",
    params: { stage: "stage1" },
    gate: "SWISS",
    gateStage: "stage1",
    kodBlokady: "server.lock.phaseClosed",
    kodNieaktualny: "server.stale.swiss",
    tabela: "swiss_predictions",
    body: { three_zero: ["A"], zero_three: ["B"], advancing: ["C", "D"] },
    typ: { three_zero: ["A"], zero_three: ["B"], advancing: ["C", "D"] },
  },
  {
    nazwa: "Play-In",
    modul: "../server/routes/publicPickemPlayin.js",
    rejestrator: "registerPublicPickemPlayinRoutes",
    sciezka: "/api/public/events/:slug/playin-pickem",
    params: {},
    gate: "PLAYIN",
    gateStage: null,
    kodBlokady: "server.lock.playinClosed",
    kodNieaktualny: "server.stale.playin",
    tabela: "playin_predictions",
    body: { teams: ["A", "B"] },
    typ: { teams: ["A", "B"] },
  },
  {
    nazwa: "Playoffs",
    modul: "../server/routes/publicPickemPlayoffs.js",
    rejestrator: "registerPublicPickemPlayoffsRoutes",
    sciezka: "/api/public/events/:slug/playoffs-pickem",
    params: {},
    gate: "PLAYOFFS",
    gateStage: null,
    kodBlokady: "server.lock.playoffsClosed",
    kodNieaktualny: "server.stale.playoffs",
    tabela: "playoffs_predictions",
    // Drabinka ma wlasne reguly: zwyciezca z finalistow, finalisci
    // z polfinalistow, trzecie miejsce z polfinalistow i poza finalem.
    body: {
      semifinalists: ["A", "B", "C", "D"],
      finalists: ["A", "B"],
      winner: "A",
      third_place_winner: "C",
    },
    typ: {
      semifinalists: ["A", "B", "C", "D"],
      finalists: ["A", "B"],
      winner: "A",
      third_place_winner: "C",
    },
  },
  {
    nazwa: "Double Elimination",
    modul: "../server/routes/publicPickemDoubleElim.js",
    rejestrator: "registerPublicPickemDoubleElimRoutes",
    sciezka: "/api/public/events/:slug/doubleelim-pickem",
    params: {},
    gate: "DOUBLEELIM",
    gateStage: null,
    kodBlokady: "server.lock.deClosed",
    kodNieaktualny: "server.stale.de",
    tabela: "doubleelim_predictions",
    body: {
      upper_final_a: ["A", "B"],
      lower_final_a: ["C", "D"],
      upper_final_b: ["E", "F"],
      lower_final_b: ["G", "H"],
    },
    typ: {
      upper_final_a: ["A", "B"],
      lower_final_a: ["C", "D"],
      upper_final_b: ["E", "F"],
      lower_final_b: ["G", "H"],
    },
  },
];

const AKTYWNE = ["A", "B", "C", "D", "E", "F", "G", "H"];

function fakeApp() {
  const trasy = new Map();

  return {
    trasy,
    get(sciezka, handler) {
      trasy.set(`GET ${sciezka}`, handler);
    },
    post(sciezka, handler) {
      trasy.set(`POST ${sciezka}`, handler);
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

/**
 * Atrapa puli. Zapisuje KAZDE zapytanie, zeby dalo sie sprawdzic nie tylko
 * odpowiedz, ale i to, czy zapis w ogole poszedl.
 */
// `brakEventu` osobna flaga, a nie event: undefined - wartosc domyslna
// w destrukturyzacji wskakuje wlasnie przy undefined, wiec turniej wcale
// by nie zniknal i przypadek 404 sprawdzalby co innego, niz mysli.
function fakePool({ brakEventu = false } = {}) {
  const event = brakEventu ? undefined : { id: EVENT_ID, guild_id: GILDIA };

  const zapytania = [];

  return {
    zapytania,

    get zapisy() {
      return zapytania.filter((q) => /INSERT INTO/i.test(q.sql));
    },

    query(sql, args) {
      const tekst = String(sql);

      zapytania.push({ sql: tekst, args });

      if (/FROM events/i.test(tekst)) {
        return Promise.resolve([[event], []]);
      }

      return Promise.resolve([[], []]);
    },
  };
}

/**
 * Rejestruje JEDEN modul fazy i zwraca jego handler POST razem z atrapami.
 *
 * `nadpisz` podmienia pojedyncze zaleznosci - kazdy przypadek nizej psuje
 * dokladnie jedna rzecz i patrzy, co trasa z tym robi.
 */
async function trasaFazy(faza, nadpisz = {}) {
  const modul = await import(faza.modul);

  const app = fakeApp();
  const pool = nadpisz.pool || fakePool();

  const wywolania = { gate: [], openEvent: [], limity: [], typy: [] };

  const zaleznosci = {
    pool,

    isGuildMember: () => true,

    checkPickemGate: async (guildId, kind, stage) => {
      wywolania.gate.push({ guildId, kind, stage });

      return { allowed: true, message: null, deadline: null };
    },

    getOpenEventId: async (_pool, guildId) => {
      wywolania.openEvent.push(guildId);

      return EVENT_ID;
    },

    getPhaseLimits: async (_pool, guildId, eventId, phase) => {
      wywolania.limity.push({ guildId, eventId, phase });

      return {};
    },

    sprawdzTyp: (phase, limity, wybory) => {
      wywolania.typy.push({ phase, wybory });

      return { ok: true };
    },

    loadActiveTeams: async () => AKTYWNE,

    toWebMessage: (message, domyslne) => message ?? domyslne,

    parseCsvPick: (v) =>
      String(v || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),

    ...nadpisz,
  };

  modul[faza.rejestrator](app, zaleznosci);

  const handler = app.trasy.get(`POST ${faza.sciezka}`);

  assert.ok(handler, `${faza.nazwa}: nie zarejestrowano trasy POST`);

  return { handler, pool, wywolania };
}

async function wyslij(faza, nadpisz = {}, { sesja = SESJA, body } = {}) {
  const { handler, pool, wywolania } = await trasaFazy(faza, nadpisz);

  const res = fakeRes();

  await handler(
    {
      params: { slug: "iem-krakow-2026", ...faza.params },
      body: body || faza.body,
      session: sesja,
    },
    res,
  );

  return { res, pool, wywolania };
}

for (const faza of FAZY) {
  test(`${faza.nazwa}: bez logowania 401 i zero zapisow`, async () => {
    const { res, pool } = await wyslij(faza, {}, { sesja: {} });

    assert.equal(res.stan.kod, 401);
    assert.equal(res.stan.body.code, "server.mustLogin");
    assert.deepEqual(pool.zapisy, []);
  });

  test(`${faza.nazwa}: nieznany turniej to 404`, async () => {
    const { res, pool } = await wyslij(faza, {
      pool: fakePool({ brakEventu: true }),
    });

    assert.equal(res.stan.kod, 404);
    assert.equal(res.stan.body.code, "server.eventNotFound");
    assert.deepEqual(pool.zapisy, []);
  });

  test(`${faza.nazwa}: ktos spoza serwera dostaje 403`, async () => {
    const { res, pool } = await wyslij(faza, { isGuildMember: () => false });

    assert.equal(res.stan.kod, 403);
    assert.equal(res.stan.body.code, "server.notMember");
    assert.deepEqual(pool.zapisy, []);
  });

  test(`${faza.nazwa}: pyta o SWOJ gate`, async () => {
    // Najgrozniejsza pomylka przy scalaniu czterech kopii: faza pytajaca
    // o gate innej fazy zapisywalaby typy przy zamknietym typowaniu.
    const { wywolania } = await wyslij(faza);

    assert.equal(wywolania.gate.length, 1);
    assert.equal(wywolania.gate[0].kind, faza.gate);
    assert.equal(wywolania.gate[0].guildId, GILDIA);

    // Brak etapu to dla gate'a null ALBO undefined - checkPickemGate ma tam
    // wartosc domyslna null, wiec jedno i drugie znaczy to samo. Test pilnuje
    // ZNACZENIA (Swiss podaje etap, pozostale fazy nie), a nie liczby
    // argumentow wywolania.
    assert.equal(wywolania.gate[0].stage ?? null, faza.gateStage);
  });

  test(`${faza.nazwa}: zamkniete typowanie to 403 ze zdaniem i kodem`, async () => {
    const { res, pool } = await wyslij(faza, {
      checkPickemGate: async () => ({ allowed: false, message: null }),
    });

    assert.equal(res.stan.kod, 403);
    assert.ok(res.stan.body.error, "brak zdania o blokadzie");
    assert.equal(res.stan.body.code, faza.kodBlokady);
    assert.deepEqual(pool.zapisy, []);
  });

  test(`${faza.nazwa}: wlasny powod administratora idzie bez kodu`, async () => {
    const powod = "Zamykam o 18:00.";

    const { res } = await wyslij(faza, {
      checkPickemGate: async () => ({ allowed: false, message: powod }),
    });

    assert.equal(res.stan.kod, 403);
    assert.equal(res.stan.body.error, powod);
    assert.equal(res.stan.body.code, null);
  });

  test(`${faza.nazwa}: brak aktywnego turnieju to 403`, async () => {
    const { res, pool } = await wyslij(faza, {
      getOpenEventId: async () => null,
    });

    assert.equal(res.stan.kod, 403);
    assert.deepEqual(pool.zapisy, []);
  });

  test(`${faza.nazwa}: formularz starego turnieju to 409, nie zapis`, async () => {
    // Slug w adresie wskazuje turniej 42, a otwarty jest 99. Bez tej kontroli
    // zapis szedl na event_id ze sluga, czyli do cudzego turnieju.
    const { res, pool } = await wyslij(faza, {
      getOpenEventId: async () => 99,
    });

    assert.equal(res.stan.kod, 409);
    assert.equal(res.stan.body.code, faza.kodNieaktualny);
    assert.deepEqual(pool.zapisy, []);
  });

  test(`${faza.nazwa}: druzyna poza rosterem to 400, nie zapis`, async () => {
    const { res, pool } = await wyslij(faza, {
      loadActiveTeams: async () => [],
    });

    assert.equal(res.stan.kod, 400);
    assert.ok(res.stan.body.error, "brak informacji, ktore druzyny sa zle");
    assert.deepEqual(pool.zapisy, []);
  });

  test(`${faza.nazwa}: limity czytane dla wlasnej fazy i AKTUALNEGO eventu`, async () => {
    const { wywolania } = await wyslij(faza);

    assert.equal(wywolania.limity.length, 1);
    assert.equal(wywolania.limity[0].guildId, GILDIA);
    assert.equal(
      wywolania.limity[0].eventId,
      EVENT_ID,
      "limity musza isc z aktualnego eventu, nie ze sluga",
    );
  });

  test(`${faza.nazwa}: poprawny typ laduje we wlasnej tabeli`, async () => {
    const { res, pool } = await wyslij(faza);

    assert.equal(res.stan.kod, 200, JSON.stringify(res.stan.body));
    assert.equal(res.stan.body.ok, true);
    assert.deepEqual(res.stan.body.prediction, faza.typ);

    assert.equal(pool.zapisy.length, 1, "zapis ma byc dokladnie jeden");

    const zapis = pool.zapisy[0];

    assert.match(zapis.sql, new RegExp(`INSERT INTO ${faza.tabela}\\b`));

    // Zapis identyfikuje gracza i trafia do AKTUALNEGO eventu.
    assert.ok(zapis.args.includes(SESJA.user.id), "brak id gracza w zapisie");
    assert.ok(zapis.args.includes(EVENT_ID), "zapis poszedl na inny event");
    assert.ok(zapis.args.includes(GILDIA), "brak id serwera w zapisie");
  });
}

test("wszystkie cztery fazy maja wlasny kod blokady i wlasny kod nieaktualnego formularza", () => {
  // Kody sa jedynym, co prowadzi do tlumaczenia, a przy czterech kopiach
  // najlatwiej bylo zostawic kod poprzedniej fazy.
  const blokady = new Set(FAZY.map((f) => f.kodBlokady));
  const nieaktualne = new Set(FAZY.map((f) => f.kodNieaktualny));

  assert.equal(blokady.size, FAZY.length);
  assert.equal(nieaktualne.size, FAZY.length);
});
