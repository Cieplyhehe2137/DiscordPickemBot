// Trasa czytania wynikow map (server/routes/maps.js).
//
// Atrapa puli - nic nie laczy sie z baza. Test liczy FALE zapytan, bo kazda
// to osobna podroz do bazy stojacej na innej maszynie niz API: zmierzone na
// serwerze 177 ms, niezaleznie od tego, ile wierszy wraca.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/maps.js";

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

// Jedna mapa, trzydziestu typujacych - tyle, ile wynosi prog w trasie.
const TYPY = Array.from({ length: 30 }, (_, i) => ({
  match_id: i + 1,
  map_no: 1,
  user_id: "czytelnik",
  pred_exact_a: 13,
  pred_exact_b: 11,
  exact_a: 13,
  exact_b: 5,
}));

const PROFILE = [{ user_id: "czytelnik", displayname: "Z profilu", avatar: "abc" }];
const NAZWY = [{ user_id: "czytelnik", displayname: "Z fazy" }];

function daneDla(sql) {
  if (sql.includes("`swiss_predictions`")) return NAZWY;
  if (sql.includes("FROM user_profiles")) return PROFILE;

  return TYPY;
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
  const { registerMapRoutes } = await import(MODUL);

  const app = fakeApp();

  registerMapRoutes(app, { pool });

  const handler = app.trasy.get("GET /api/public/maps");

  assert.ok(handler, "trasa musi byc zarejestrowana");

  return handler;
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

  const odpowiedz = handler({}, fakeRes());

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

test("drugie wejscie nie dotyka bazy", async () => {
  const licznik = { zapytan: 0 };

  const handler = await zbuduj(liczacaPula(licznik));

  await handler({}, fakeRes());
  await handler({}, fakeRes());

  assert.equal(licznik.zapytan, 3, "druga odpowiedz ma isc z pamieci podrecznej");
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

  await Promise.all(Array.from({ length: 50 }, () => handler({}, fakeRes())));

  assert.equal(licznik.zapytan, 3, `zapytan: ${licznik.zapytan}`);
});

test("odpowiedz niesie obie srednie, bo o nie tu chodzi", async () => {
  // Typowano 13:11 (roznica 2), padlo 13:5 (roznica 8).
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler({}, res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(res.zapis.tresc.avg_predicted_gap, 2);
  assert.equal(res.zapis.tresc.avg_actual_gap, 8);
});

test("odpowiedz niesie prog, a nie tylko listy", async () => {
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler({}, res);

  assert.equal(res.zapis.tresc.min_picks, 30);
});

test("gracz z progiem typow trafia do zestawienia razem z nazwa z profilu", async () => {
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler({}, res);

  const [czytelnik] = res.zapis.tresc.readers;

  assert.equal(czytelnik.displayname, "Z profilu");
  assert.equal(czytelnik.picks, 30);
  assert.equal(czytelnik.deviation, 6, "|13-13| + |11-5|");
});

test("zapytanie bierze TYLKO typy z wynikiem", async () => {
  // Typ na mape bez wyniku nie moze byc ani trafieniem, ani pudlem.
  const fs = require("node:fs");
  const path = require("node:path");

  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "maps.js"),
    "utf8",
  );

  assert.match(tresc, /INNER JOIN match_map_results r/);
  assert.match(tresc, /r\.exact_a IS NOT NULL/);
  assert.match(tresc, /p\.pred_exact_a IS NOT NULL/);

  // Zlaczenie po parze (mecz, numer mapy) - nazwy mapy w danych nie ma.
  assert.match(tresc, /ON r\.match_id = p\.match_id\s+AND r\.map_no = p\.map_no/);
});

test("awaria bazy konczy sie piecsetka, a nie pusta strona", async () => {
  const pool = {
    async query() {
      throw new Error("baza padla");
    },
  };

  const handler = await zbuduj(pool);

  const res = fakeRes();

  await handler({}, res);

  assert.equal(res.zapis.kod, 500);
  assert.equal(res.zapis.tresc.code, "server.mapsFailed");
});
