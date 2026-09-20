// Faza meczu musi byc ta sama po stronie zapisu i odczytu.
//
// SKAD SIE TO WZIELO. Formularz "dodaj mecz" w panelu oferowal SWISS,
// PLAY_IN, PLAYOFFS i DOUBLE_ELIM, a panel Discorda pyta o mecze
// `WHERE m.phase = ?` wartosciami swiss_stage1..3 / playin / playoffs /
// doubleelim. Serwer wpisywal do bazy to, co przyszlo z frontu, bez
// sprawdzenia. Zmierzone na produkcji: z czterech pozycji tamtej listy
// TRZY trafialy w zero meczow, a mecz zalozony jako "SWISS" nie pojawial
// sie w zadnym panelu - ani na Stage 1, ani nigdzie indziej.
//
// Te testy pilnuja trzech rzeczy naraz: ze serwer odrzuca faze, ktorej
// nie da sie wytypowac, ze zapisuje postac kanoniczna niezaleznie od
// zapisu na wejsciu, i ze obie listy na froncie oferuja dokladnie to, co
// panel Discorda potrafi odpytac.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { normalizePhase } = require("../utils/phaseNames.js");

const KORZEN = path.join(__dirname, "..");

const GILDIA = "1221762685595553834";
const SLUG = "iem-krakow-2026";

/** Fazy, dla ktorych utils/pickemPanelBuilder.js wystawia panel z meczami. */
const FAZY_PANELU = [
  "swiss_stage1",
  "swiss_stage2",
  "swiss_stage3",
  "playin",
  "playoffs",
  "doubleelim",
];

function fakeApp() {
  const trasy = new Map();

  return {
    trasy,
    get(sciezka, ...reszta) {
      trasy.set(`GET ${sciezka}`, reszta[reszta.length - 1]);
    },
    post(sciezka, ...reszta) {
      trasy.set(`POST ${sciezka}`, reszta[reszta.length - 1]);
    },
  };
}

function fakePool(zapisy) {
  return {
    query(sql, args) {
      const tekst = String(sql);

      if (tekst.includes("INSERT INTO matches")) {
        zapisy.push(args);

        return Promise.resolve([{ insertId: 1 }, []]);
      }

      if (tekst.includes("FROM events")) {
        return Promise.resolve([[{ id: 88, guild_id: GILDIA }], []]);
      }

      if (tekst.includes("FROM teams")) {
        return Promise.resolve([[{ name: "FURIA" }, { name: "MOUZ" }], []]);
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

async function dodajMecz(phase) {
  const { registerGuildEventRoutes } = await import(
    "../server/routes/guildEvents.js"
  );

  const zapisy = [];
  const app = fakeApp();

  registerGuildEventRoutes(app, {
    getOpenEventId: async () => 88,
    io: { emit() {} },
    logInfo() {},
    nextMatchNumber: async () => 1,
    normalizePhase,
    parseMatchList: () => ({ mecze: [], bledy: [], duplikaty: [] }),
    pool: fakePool(zapisy),
    requireGuildAdmin: () => (req, res, next) => next(),
    runInTransaction: async (pool, fn) => fn(pool),
  });

  const handler = app.trasy.get(
    "POST /api/guilds/:guildId/events/:slug/matches",
  );

  const res = fakeRes();

  await handler(
    {
      params: { guildId: GILDIA, slug: SLUG },
      body: { phase, teamA: "FURIA", teamB: "MOUZ", bestOf: 3 },
      session: { user: { id: "1" } },
    },
    res,
  );

  return { res, zapisy };
}

test("faza, ktorej nie da sie wytypowac, NIE trafia do bazy", async () => {
  // Gole "SWISS" bylo wartoscia domyslna formularza. Panel Swiss bez numeru
  // etapu nie istnieje, wiec taki mecz nie mial gdzie sie pokazac.
  const { res, zapisy } = await dodajMecz("SWISS");

  assert.equal(res.stan.kod, 400);
  assert.equal(res.stan.body.code, "server.badMatchPhase");
  assert.deepEqual(zapisy, [], "nic nie poszlo do bazy");
});

test("odrzucenie mowi, co wybrac zamiast tego", async () => {
  // Komunikat "nieprawidlowa faza" bez listy zostawia admina dokladnie tam,
  // gdzie byl - z formularzem, ktory nie przyjmuje tego, co oferuje.
  const { res } = await dodajMecz("SWISS");

  for (const faza of ["SWISS_STAGE1", "PLAYIN", "DOUBLEELIM"]) {
    assert.ok(
      res.stan.body.allowed.includes(faza),
      `brak ${faza} w podpowiedzi`,
    );
  }
});

test("PLAY_IN i DOUBLE_ELIM sa POPRAWIANE, a nie odrzucane", async () => {
  // Obie stały w starym formularzu i obie trafialy w ZERO meczow w bazie,
  // bo prawdziwe wartosci nie maja podkreslnika. Ale rozni sie to od
  // "SWISS" jedna rzecza: wiadomo, o ktora faze chodzilo, wiec odrzucenie
  // byloby zlosliwoscia. Ma to znaczenie praktyczne - przegladarka z
  // zaladowana stara wersja strony dalej dziala i zapisuje poprawnie.
  for (const [faza, oczekiwane] of [
    ["PLAY_IN", "PLAYIN"],
    ["DOUBLE_ELIM", "DOUBLEELIM"],
  ]) {
    const { res, zapisy } = await dodajMecz(faza);

    assert.equal(res.stan.kod, 200, faza);
    assert.equal(zapisy[0][2], oczekiwane, faza);
  }
});

test("zapis idzie w postaci KANONICZNEJ, nie w tej z zadania", async () => {
  // Front wysyla 'swiss_stage1', bot kiedys wysylal 'SWISS_STAGE_1', a stare
  // wiersze maja 'SWISS_STAGE1'. Do bazy ma trafiac jedna postac, inaczej
  // kolumna znow zbiera warianty zapisu.
  for (const [wejscie, oczekiwane] of [
    ["swiss_stage1", "SWISS_STAGE1"],
    ["SWISS_STAGE_2", "SWISS_STAGE2"],
    ["stage3", "SWISS_STAGE3"],
    ["play-in", "PLAYIN"],
    ["double_elim", "DOUBLEELIM"],
    ["playoffs", "PLAYOFFS"],
  ]) {
    const { res, zapisy } = await dodajMecz(wejscie);

    assert.equal(res.stan.kod, 200, wejscie);
    assert.equal(zapisy[0][2], oczekiwane, `${wejscie} -> ${oczekiwane}`);
    assert.equal(res.stan.body.match.phase, oczekiwane, "odpowiedz zgodna z baza");
  }
});

test("formularz w panelu oferuje DOKLADNIE fazy panelu Discorda", () => {
  const zrodlo = fs.readFileSync(
    path.join(KORZEN, "web/src/pages/AdminPage.jsx"),
    "utf8",
  );

  const blok = zrodlo.slice(
    zrodlo.indexOf("const FAZY_MECZU = ["),
    zrodlo.indexOf("];", zrodlo.indexOf("const FAZY_MECZU = [")),
  );

  assert.ok(blok, "nie znaleziono listy faz w AdminPage.jsx");

  const klucze = [...blok.matchAll(/klucz:\s*"([^"]+)"/g)].map((m) => m[1]);

  assert.deepEqual(klucze, FAZY_PANELU);
});

test("strona Moje typy pyta o te same fazy", () => {
  // Ta lista tez byla rozjechana: jej cztery zakladki dociagaly 14 ze 157
  // meczow, a Play-In i Double Elim byly puste w kazdym turnieju.
  const zrodlo = fs.readFileSync(
    path.join(KORZEN, "web/src/pages/MyPicksPage.jsx"),
    "utf8",
  );

  const blok = zrodlo.slice(
    zrodlo.indexOf("const PHASES = ["),
    zrodlo.indexOf("];", zrodlo.indexOf("const PHASES = [")),
  );

  const klucze = [...blok.matchAll(/key:\s*"([^"]+)"/g)].map((m) => m[1]);

  assert.deepEqual(klucze, FAZY_PANELU);
});

test("kazda faza panelu przechodzi przez normalizePhase na cos rozpoznawalnego", () => {
  // Gdyby ktos dolozyl faze do pickemPanelBuilder i zapomnial o aliasie,
  // serwer odrzucalby mecze w fazie, ktora Discord juz pokazuje.
  const builder = fs.readFileSync(
    path.join(KORZEN, "utils/pickemPanelBuilder.js"),
    "utf8",
  );

  const konfiguracja = builder.slice(
    builder.indexOf("const phasesConfig = {"),
    builder.indexOf("function buildDescription"),
  );

  const zBuildera = [...konfiguracja.matchAll(/^ {2}([a-z_0-9]+): \{/gm)].map(
    (m) => m[1],
  );

  assert.deepEqual(
    zBuildera.slice().sort(),
    FAZY_PANELU.slice().sort(),
    "panel Discorda zna inne fazy niz ten test",
  );

  const guildEvents = fs.readFileSync(
    path.join(KORZEN, "server/routes/guildEvents.js"),
    "utf8",
  );

  const dozwolone = guildEvents.slice(
    guildEvents.indexOf("const FAZY_MECZOW = new Set(["),
    guildEvents.indexOf("]);", guildEvents.indexOf("const FAZY_MECZOW")),
  );

  for (const faza of zBuildera) {
    assert.ok(
      dozwolone.includes(`"${normalizePhase(faza)}"`),
      `serwer nie przyjmuje fazy ${faza}, ktora panel juz wystawia`,
    );
  }
});
