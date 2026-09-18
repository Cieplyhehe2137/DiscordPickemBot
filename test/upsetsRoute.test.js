// Trasa niespodzianek (server/routes/upsets.js).
//
// Atrapa puli - nic nie laczy sie z baza. Test liczy FALE zapytan, bo kazda
// to osobna podroz do bazy stojacej na innej maszynie niz API: zmierzone na
// serwerze 177 ms, niezaleznie od tego, ile wierszy wraca. Piec zapytan
// puszczonych rownolegle kosztuje jedna podroz, te same piec po kolei -
// piec. Milisekundy na cudzej maszynie nic nie znacza, liczba fal znaczy
// wszystko.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/upsets.js";

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

// Dwa mecze: jeden wygrany przez faworyta, jeden przez outsidera. Do tego
// dwoje typujacych, z ktorych jeden postawil pod prad.
const MECZE = [
  {
    id: 1,
    event_id: 1,
    phase: "SWISS_STAGE3",
    team_a: "Vitality",
    team_b: "9z",
    res_a: 0,
    res_b: 2,
    event_name: "Turniej",
    event_slug: "turniej",
    for_a: 40,
    for_b: 1,
    total: 41,
  },
  {
    id: 2,
    event_id: 1,
    phase: "PLAYOFFS",
    team_a: "Vitality",
    team_b: "FaZe",
    res_a: 2,
    res_b: 0,
    event_name: "Turniej",
    event_slug: "turniej",
    for_a: 35,
    for_b: 6,
    total: 41,
  },
];

const TYPY = [
  { user_id: "podprad", match_id: 1, pred_a: 0, pred_b: 2 },
  { user_id: "podprad", match_id: 2, pred_a: 2, pred_b: 0 },
  { user_id: "zeWszystkimi", match_id: 1, pred_a: 2, pred_b: 0 },
  { user_id: "zeWszystkimi", match_id: 2, pred_a: 2, pred_b: 0 },
];

const PROFILE = [
  { user_id: "podprad", displayname: "Pod prad", avatar: null },
  { user_id: "zeWszystkimi", displayname: "Ze wszystkimi", avatar: null },
];

// Nazwy z tabel faz - dla graczy, ktorzy nigdy nie zalogowali sie na
// stronie. Pierwszy ma juz nazwe w profilu i ta z fazy ma jej NIE
// nadpisac; drugi nie ma zadnej innej.
const NAZWY = [
  { user_id: "podprad", displayname: "Nick sprzed roku" },
  { user_id: "tylkoDiscord", displayname: "Tylko Discord" },
];

const LOGOTYPY = [{ name_key: "vitality", logo_url: "https://x/v.png" }];

// Odpowiedz dobrana po tresci zapytania - atrapa nie wie, w jakiej
// kolejnosci trasa je puszcza, i nie powinna tego zakladac.
function daneDla(sql) {
  if (sql.includes("FROM user_profiles")) return PROFILE;
  if (sql.includes("FROM swiss_predictions")) return NAZWY;
  if (sql.includes("team_logos")) return LOGOTYPY;
  if (sql.includes("FROM match_predictions p")) return TYPY;

  return MECZE;
}

function liczacaPula(licznik) {
  return {
    async query(sql) {
      licznik.zapytan += 1;

      return [daneDla(sql), []];
    },
  };
}

async function zbuduj(pool) {
  const { registerUpsetsRoutes } = await import(MODUL);

  const app = fakeApp();

  registerUpsetsRoutes(app, { pool });

  const handler = app.trasy.get("GET /api/public/upsets");

  assert.ok(handler, "trasa musi byc zarejestrowana");

  return handler;
}

test("wszystkie zapytania ida JEDNA fala", async () => {
  // To jest jedyna rzecz, ktora ta trasa moze zepsuc kosztowo. Piec zapytan
  // po kolei to piec podrozy do bazy zamiast jednej - a zadne z nich nie
  // potrzebuje wyniku poprzedniego.
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

  const odpowiedz = handler({}, fakeRes());

  // Kilka obrotow petli zdarzen wystarczy, zeby trasa zdazyla puscic
  // wszystko, co puszcza rownolegle. Zadne zapytanie nie odpowiedzialo.
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  assert.equal(
    rozpoczete,
    5,
    `przed pierwsza odpowiedzia baza powinna dostac wszystkie piec zapytan, dostala ${rozpoczete}`,
  );

  for (const otworz of bramki) otworz();

  await odpowiedz;
});

test("drugie wejscie nie dotyka bazy", async () => {
  const licznik = { zapytan: 0 };

  const handler = await zbuduj(liczacaPula(licznik));

  await handler({}, fakeRes());
  await handler({}, fakeRes());

  assert.equal(licznik.zapytan, 5, "druga odpowiedz ma isc z pamieci podrecznej");
});

test("piecdziesiat rownoczesnych wejsc to JEDNO przeliczenie", async () => {
  // Chwila, w ktorej ta pamiec ma znaczenie: zaraz po meczu, ktory wszystkich
  // zaskoczyl, i o ktorym wszyscy wchodza poczytac.
  const licznik = { zapytan: 0 };

  const pool = {
    async query(sql) {
      licznik.zapytan += 1;

      await new Promise((r) => setTimeout(r, 10));

      return [daneDla(sql), []];
    },
  };

  const handler = await zbuduj(pool);

  await Promise.all(Array.from({ length: 50 }, () => handler({}, fakeRes())));

  assert.equal(licznik.zapytan, 5, `zapytan: ${licznik.zapytan}`);
});

test("w odpowiedzi jest mecz, ktory zaskoczyl, i nie ma tego, ktory nie", async () => {
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler({}, res);

  const mecze = res.zapis.tresc.upsets;

  assert.equal(mecze.length, 1);
  assert.equal(mecze[0].match_id, 1);
  assert.equal(mecze[0].winner, "9z");
  assert.equal(mecze[0].picks_for_winner, 1);
  assert.equal(mecze[0].picks_total, 41);

  // Adres meczu na stronie sklada sie ze slugu turnieju i identyfikatora,
  // wiec oba musza dojsc do przegladarki.
  assert.equal(mecze[0].event_slug, "turniej");
  assert.equal(mecze[0].phase, "SWISS_STAGE3");
});

test("zestawienie graczy liczy sie tylko z meczow-niespodzianek", async () => {
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler({}, res);

  const gracze = res.zapis.tresc.contrarians;

  // Prog okazji w trasie wynosi dwanascie, a w tej atrapie jest jedna -
  // wiec lista ma byc pusta i to jest poprawne zachowanie, nie brak danych.
  assert.deepEqual(gracze, []);
});

test("odpowiedz niesie progi, a nie tylko listy", async () => {
  // Strona ma powiedziec wprost, czego brakuje komus, kogo w zestawieniu
  // nie ma. Progi zaszyte w widoku rozjechalyby sie z tym, co robi serwer.
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler({}, res);

  assert.equal(res.zapis.tresc.min_picks, 20);
  assert.equal(res.zapis.tresc.threshold_percent, 25);
  assert.equal(res.zapis.tresc.min_chances, 12);
  assert.equal(res.zapis.tresc.min_team_matches, 5);
});

test("tlo jedzie razem z lista, bo bez niego procenty nic nie znacza", async () => {
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler({}, res);

  // Jedna niespodzianka: 1 trafienie na 41 typow.
  assert.equal(res.zapis.tresc.crowd_rate, 2);
});

test("statystyki druzyn licza sie tym samym modulem, co strona druzyny", async () => {
  // Rozjazd tych dwoch dalby inne "zaufanie" na stronie druzyny niz to,
  // ktore stoi za jej miejscem w zestawieniu przecenionych.
  const fs = require("node:fs");
  const path = require("node:path");

  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "upsets.js"),
    "utf8",
  );

  assert.match(tresc, /import \{ buildTeamStats \} from "\.\.\/lib\/teamStats\.js"/);
});

test("awaria bazy konczy sie piecsetka, a nie pusta lista", async () => {
  // Pusta lista wyglada jak "nic jeszcze nikogo nie zaskoczylo" i nie
  // zglasza sie sama. Piecsetka trafia do logow i na ekran.
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
  assert.equal(res.zapis.tresc.code, "server.upsetsFailed");
});
