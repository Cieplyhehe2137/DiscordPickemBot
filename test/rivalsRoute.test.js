// Trasa rywali gracza (server/routes/rivals.js).
//
// Atrapa puli - nic nie laczy sie z baza. Test liczy FALE zapytan, bo kazda
// to osobna podroz do bazy stojacej na innej maszynie niz API: zmierzone na
// serwerze 177 ms, niezaleznie od tego, ile wierszy wraca.
//
// Pamiec podreczna jest tu wazniejsza niz gdzie indziej: trzyma to, co NIE
// zalezy od gracza, wiec jeden wpis obsluguje profile WSZYSTKICH graczy
// tego turnieju. Dlatego osobny przypadek pilnuje, ze drugi gracz nie
// odpytuje bazy od nowa - i ze mimo to dostaje SWOJ bilans, a nie cudzy.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/rivals.js";

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

// Dziesiec rozstrzygnietych meczow - tyle, ile wynosi prog w module.
// "gracz" bierze komplet w kazdym, "rywal" nie bierze nic: bilans 10-0.
const PUNKTY = Array.from({ length: 10 }, (_, i) => [
  { user_id: "gracz", match_id: i + 1, points: 4 },
  { user_id: "rywal", match_id: i + 1, points: 0 },
]).flat();

const PROFILE = [{ user_id: "rywal", displayname: "Z profilu", avatar: "abc" }];
const NAZWY = [{ user_id: "rywal", displayname: "Z fazy" }];

function daneDla(sql) {
  if (sql.includes("SELECT id, name, slug")) return EVENT;
  if (sql.includes("MAX(nazwa) AS displayname")) return NAZWY;
  if (sql.includes("FROM user_profiles")) return PROFILE;

  return PUNKTY;
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
  const { registerRivalsRoutes } = await import(MODUL);

  const app = fakeApp();

  registerRivalsRoutes(app, { pool });

  const handler = app.trasy.get(
    "GET /api/public/events/:slug/players/:userId/rivals",
  );

  assert.ok(handler, "trasa musi byc zarejestrowana");

  return handler;
}

function req(userId = "gracz", slug = "cologne") {
  return { params: { slug, userId } };
}

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

  const odpowiedz = handler(req(), fakeRes());

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

test("drugi gracz tego samego turnieju nie dotyka bazy", async () => {
  // To jest cel calej konstrukcji: w pamieci lezy turniej, nie gracz.
  const licznik = { zapytan: 0 };

  const handler = await zbuduj(liczacaPula(licznik));

  await handler(req("gracz"), fakeRes());
  await handler(req("rywal"), fakeRes());

  assert.equal(licznik.zapytan, 4, "drugi gracz ma isc z pamieci podrecznej");
});

test("...i mimo pamieci dostaje SWOJ bilans, a nie cudzy", async () => {
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const pierwszy = fakeRes();
  const drugi = fakeRes();

  await handler(req("gracz"), pierwszy);
  await handler(req("rywal"), drugi);

  assert.equal(pierwszy.zapis.tresc.rivals[0].user_id, "rywal");
  assert.equal(pierwszy.zapis.tresc.rivals[0].wins, 10);

  assert.equal(drugi.zapis.tresc.rivals[0].user_id, "gracz");
  assert.equal(drugi.zapis.tresc.rivals[0].losses, 10);
});

test("piecdziesiat rownoczesnych wejsc to JEDNO przeliczenie", async () => {
  const licznik = { zapytan: 0 };

  const pool = {
    async query(sql) {
      licznik.zapytan += 1;

      await new Promise((r) => setTimeout(r, 10));

      return [daneDla(sql), []];
    },
  };

  const handler = await zbuduj(pool);

  await Promise.all(
    Array.from({ length: 50 }, () => handler(req(), fakeRes())),
  );

  assert.equal(licznik.zapytan, 4, `zapytan: ${licznik.zapytan}`);
});

test("odpowiedz niesie prog, bo strona ma powiedziec, czego brakuje", async () => {
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.tresc.min_decided, 10);
});

test("nazwa idzie z profilu, nie z fazy", async () => {
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.tresc.rivals[0].displayname, "Z profilu");
  assert.equal(res.zapis.tresc.rivals[0].avatar, "abc");
});

test("nieznany turniej to czterysta cztery, a nie pusta lista", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT id, name, slug")) return [[], []];

      return [daneDla(sql), []];
    },
  };

  const handler = await zbuduj(pool);

  const res = fakeRes();

  await handler(req("gracz", "nie-ma-takiego"), res);

  assert.equal(res.zapis.kod, 404);
  assert.equal(res.zapis.tresc.code, "server.eventNotFound");
});

test("zapytanie o punkty bierze TYLKO mecze rozstrzygniete i sumuje na mecz", async () => {
  const fs = require("node:fs");
  const path = require("node:path");

  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "rivals.js"),
    "utf8",
  );

  // Mecz bez wyniku dawalby obu graczom zero, czyli falszywy remis.
  assert.match(tresc, /INNER JOIN match_results mr/);

  // match_points trzyma osobno punkty za serie i za mapy - bez sumowania
  // na mecz kazdy mecz liczylby sie dwa razy.
  assert.match(tresc, /COALESCE\(SUM\(pts\.points\), 0\) AS points/);
  assert.match(tresc, /GROUP BY mp\.user_id, mp\.match_id/);

  // Zmierzone: par w match_points 6425, par z typow 6424. Bez tego zrodla
  // powstalby rywal z meczu, ktorego nikt nie obstawil.
  assert.match(tresc, /FROM match_predictions mp/);
});

test("awaria bazy konczy sie piecsetka, a nie pusta sekcja", async () => {
  const pool = {
    async query() {
      throw new Error("baza padla");
    },
  };

  const handler = await zbuduj(pool);

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.kod, 500);
  assert.equal(res.zapis.tresc.code, "server.rivalsFailed");
});
