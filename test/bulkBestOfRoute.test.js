// Hurtowa zmiana formatu calej fazy (server/routes/guildEvents.js).
//
// Format wpisuje sie przy zakladaniu meczow, zanim ktokolwiek zobaczy
// drabinke - i wtedy najlatwiej go pomylic. Poprawka pojedynczego meczu
// istniala od dawna, ale jeden mecz na raz: osiem klikniec na Swiss Stage 1,
// trzydziesci trzy na pelnym Majorze.
//
// Atrapa puli - nic nie laczy sie z baza.

const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizePhase } = require("../utils/phaseNames");

const MODUL = "../server/routes/guildEvents.js";

const SCIEZKA = "POST /api/guilds/:guildId/events/:slug/matches/best-of";

function fakeApp() {
  const trasy = new Map();

  const zapamietaj = (metoda) => (sciezka, ...reszta) => {
    trasy.set(`${metoda} ${sciezka}`, reszta[reszta.length - 1]);
  };

  return { trasy, get: zapamietaj("GET"), post: zapamietaj("POST") };
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

function mecz({ id, nr, bo = 1, typow = 0, wynikow = 0, punktow = 0 }) {
  return {
    id,
    match_no: nr,
    team_a: `A${id}`,
    team_b: `B${id}`,
    best_of: bo,
    typow,
    wynikow,
    punktow,
  };
}

/**
 * Buduje trase na atrapach i oddaje uchwyty do tego, co zrobila.
 *
 * @param mecze wiersze, ktore "baza" odda na zapytanie o mecze fazy
 */
async function zbuduj(mecze, { event = { id: 7, name: "Event" } } = {}) {
  const { registerGuildEventRoutes } = await import(MODUL);

  const slad = {
    zapytania: [],
    aktualizacje: [],
    przeliczone: [],
    logi: [],
    emisje: [],
  };

  const pool = {
    async query(sql, params) {
      slad.zapytania.push({ sql, params });

      if (sql.includes("FROM events")) return [[event], []];
      if (sql.includes("FROM matches m")) return [mecze, []];

      return [[], []];
    },
  };

  const app = fakeApp();

  registerGuildEventRoutes(app, {
    getOpenEventId: async () => event.id,
    io: { emit: (nazwa, dane) => slad.emisje.push({ nazwa, dane }) },
    logInfo: (...a) => slad.logi.push(a),
    nextMatchNumber: async () => 1,
    normalizePhase,
    parseMatchList: () => ({ mecze: [], bledy: [], duplikaty: [] }),
    pool,
    recalculateMatchPoints: async (_pool, _guild, _event, matchId, bo) => {
      slad.przeliczone.push({ matchId, bo });
    },
    requireGuildAdmin: () => (req, res, next) => next(),
    runInTransaction: async (_pool, fn) =>
      fn({
        async query(sql, params) {
          slad.aktualizacje.push({ sql, params });

          return [{ affectedRows: 0 }, []];
        },
      }),
  });

  const handler = app.trasy.get(SCIEZKA);

  assert.ok(handler, "trasa musi byc zarejestrowana");

  return { handler, slad };
}

function zadanie(body) {
  return { params: { guildId: "111", slug: "turniej" }, body, session: {} };
}

test("mecze z wynikiem zostaja NIETKNIETE", async () => {
  // Zmiana BO rozliczonemu meczowi przestawia liczenie punktow za mapy pod
  // ludzmi, ktorzy je juz dostali: przy BO1 ida z pred_exact w typie, przy
  // BO3 i BO5 z osobnych typow na kazda mape. Ta sama regula stoi w edycji
  // meczu z Discorda, ktora mowi wprost "najpierw cofnij wynik".
  const { handler, slad } = await zbuduj([
    mecz({ id: 1, nr: 1, bo: 1, typow: 10 }),
    mecz({ id: 2, nr: 2, bo: 1, typow: 7, wynikow: 1 }),
  ]);

  const res = fakeRes();

  await handler(zadanie({ phase: "swiss_stage1", bestOf: 3 }), res);

  assert.equal(res.zapis.tresc.zmienione, 1);
  assert.equal(res.zapis.tresc.rozliczonych, 1);
  assert.equal(res.zapis.tresc.pominieteRozliczone.length, 1);
  assert.match(res.zapis.tresc.pominieteRozliczone[0], /#2/);

  const update = slad.aktualizacje.at(-1);

  assert.deepEqual(
    update.params.at(-1),
    [1],
    "do UPDATE trafia wylacznie mecz bez wyniku",
  );
});

test("podglad nie zapisuje NICZEGO", async () => {
  const { handler, slad } = await zbuduj([
    mecz({ id: 1, nr: 1, bo: 1, typow: 10 }),
  ]);

  const res = fakeRes();

  await handler(
    zadanie({ phase: "swiss_stage1", bestOf: 3, dryRun: true }),
    res,
  );

  assert.equal(res.zapis.tresc.dryRun, true);
  assert.equal(res.zapis.tresc.doZmiany, 1);
  assert.equal(slad.aktualizacje.length, 0, "podglad nie moze pisac do bazy");
  assert.equal(slad.emisje.length, 0, "ani odswiezac pulpitow");
});

test("zapytanie o mecze jest ograniczone do EVENTU i fazy", async () => {
  // To jest ten sam blad, przez ktory nowy turniej pokazywal mecze
  // poprzedniego: para serwer+faza nie jest unikalna, gdy serwer ma dwa
  // turnieje. Hurt dotyka wielu meczow naraz, wiec tutaj kosztowalby wiecej.
  const { handler, slad } = await zbuduj([mecz({ id: 1, nr: 1 })]);

  await handler(
    zadanie({ phase: "swiss_stage1", bestOf: 3, dryRun: true }),
    fakeRes(),
  );

  const oMecze = slad.zapytania.find((z) => z.sql.includes("FROM matches m"));

  assert.ok(oMecze, "trasa musi zapytac o mecze");
  assert.match(oMecze.sql, /m\.event_id = \?/);
  assert.match(oMecze.sql, /m\.phase = \?/);
  assert.match(oMecze.sql, /m\.guild_id = \?/);
});

test("UPDATE tez jest ograniczony do eventu i fazy", async () => {
  const { handler, slad } = await zbuduj([mecz({ id: 1, nr: 1 })]);

  await handler(zadanie({ phase: "swiss_stage1", bestOf: 3 }), fakeRes());

  const update = slad.aktualizacje.at(-1);

  assert.match(update.sql, /UPDATE matches/);
  assert.match(update.sql, /event_id = \?/);
  assert.match(update.sql, /phase = \?/);
  assert.match(update.sql, /id IN \(\?\)/);
});

test("mecze juz w tym formacie nie licza sie do zmiany", async () => {
  const { handler } = await zbuduj([
    mecz({ id: 1, nr: 1, bo: 3, typow: 5 }),
    mecz({ id: 2, nr: 2, bo: 1, typow: 4 }),
  ]);

  const res = fakeRes();

  await handler(
    zadanie({ phase: "swiss_stage1", bestOf: 3, dryRun: true }),
    res,
  );

  assert.equal(res.zapis.tresc.doZmiany, 1);
  assert.equal(res.zapis.tresc.juzWFormacie, 1);
  assert.equal(res.zapis.tresc.typow, 4, "liczymy typy TYLKO zmienianych");
});

test("przeliczamy punkty tylko tam, gdzie faktycznie wisza", async () => {
  // Rozliczone omijamy, wiec w normalnym biegu rzeczy punktow nie ma.
  // Zostaja przypadki po cofnietym wyniku. Kazde przeliczenie przebudowuje
  // klasyfikacje calego eventu, wiec wolanie go dla wszystkich meczow
  // kosztowaloby tyle przebudow, ile meczow w fazie.
  const { handler, slad } = await zbuduj([
    mecz({ id: 1, nr: 1, bo: 1, typow: 5 }),
    mecz({ id: 2, nr: 2, bo: 1, typow: 5, punktow: 12 }),
  ]);

  await handler(zadanie({ phase: "swiss_stage1", bestOf: 5 }), fakeRes());

  assert.deepEqual(
    slad.przeliczone,
    [{ matchId: 2, bo: 5 }],
    "przeliczamy mecz z punktami, i tylko jego",
  );
});

test("nie ma czego zmieniac to odmowa, a nie cichy sukces", async () => {
  const { handler, slad } = await zbuduj([mecz({ id: 1, nr: 1, bo: 3 })]);

  const res = fakeRes();

  await handler(zadanie({ phase: "swiss_stage1", bestOf: 3 }), res);

  assert.equal(res.zapis.kod, 400);
  assert.equal(res.zapis.tresc.code, "server.nothingToChange");
  assert.equal(slad.aktualizacje.length, 0);
});

test("BO musi byc jednym z trzech formatow", async () => {
  const { handler } = await zbuduj([mecz({ id: 1, nr: 1 })]);

  for (const zly of [2, 7, 0, "trzy", null]) {
    const res = fakeRes();

    await handler(zadanie({ phase: "swiss_stage1", bestOf: zly }), res);

    assert.equal(res.zapis.kod, 400, `BO ${zly} powinno zostac odrzucone`);
    assert.equal(res.zapis.tresc.code, "server.badBo");
  }
});

test("faza, ktorej nie da sie wytypowac, jest odrzucana", async () => {
  // Gole "SWISS" nie ma panelu - mecz w takiej fazie istnieje w bazie
  // i nie pokazuje sie nigdzie. Ta sama regula co przy tworzeniu meczow.
  const { handler } = await zbuduj([mecz({ id: 1, nr: 1 })]);

  const res = fakeRes();

  await handler(zadanie({ phase: "SWISS", bestOf: 3 }), res);

  assert.equal(res.zapis.kod, 400);
  assert.equal(res.zapis.tresc.code, "server.badMatchPhase");
});

test("faza przyjmuje kazdy zapis, ktory rozumie reszta systemu", async () => {
  const { handler, slad } = await zbuduj([mecz({ id: 1, nr: 1 })]);

  await handler(
    zadanie({ phase: "Play-In", bestOf: 3, dryRun: true }),
    fakeRes(),
  );

  const oMecze = slad.zapytania.find((z) => z.sql.includes("FROM matches m"));

  assert.equal(
    oMecze.params.at(-1),
    "PLAYIN",
    "do zapytania idzie postac kanoniczna",
  );
});
