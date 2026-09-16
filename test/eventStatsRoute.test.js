// Trasa statystyk turnieju (server/routes/eventStats.js).
//
// Test jest o LICZBIE PODROZY do bazy, a nie o milisekundach. Baza stoi na
// innej maszynie niz API i kazde zapytanie kosztuje okolo 165 ms, niezaleznie
// od tego, ile wierszy wraca.
//
// Ta trasa robila jedenascie takich podrozy jedna po drugiej i oddawala
// odpowiedz po 2,4 s. Dowodem, ze koszt bierze sie z podrozy, a nie z danych,
// byl StarLadder Budapest: turniej bez ANI JEDNEGO meczu, a mimo to 2,1 s.
//
// Milisekundy na cudzej maszynie nic nie znacza, wiec test liczy fale. Fala
// to zestaw zapytan wystrzelonych, zanim ktorekolwiek zdazylo wrocic - czyli
// dokladnie ta jedna podroz, za ktora sie placi.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/eventStats.js";

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

function fakePool(odpowiedz) {
  const wywolania = [];

  let falaNr = 0;
  let wLocie = 0;

  return {
    wywolania,

    get fal() {
      return falaNr;
    },

    query(sql) {
      if (wLocie === 0) falaNr += 1;

      wLocie += 1;

      wywolania.push({ sql: String(sql), fala: falaNr });

      return new Promise((resolve) => {
        setTimeout(() => {
          wLocie -= 1;
          resolve([odpowiedz(String(sql)) ?? [], []]);
        }, 0);
      });
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

const EVENT = { id: 7 };

function odpowiedzDomyslna(sql) {
  if (sql.includes("FROM events")) return [EVENT];

  return [];
}

async function wywolaj({ pool, resolveDisplayName = async () => null }) {
  const { registerEventStatsRoutes } = await import(MODUL);

  const app = fakeApp();

  registerEventStatsRoutes(app, {
    pool,
    resolveDisplayName,
    assertPredictionsAllowed: () => {},
    isMatchDeadlinePassed: () => false,
    isMatchLocked: () => false,
    matchPanelPhaseFor: () => null,
  });

  const handler = app.trasy.get("GET /api/events/:slug/stats");

  assert.ok(handler, "trasa statystyk musi byc zarejestrowana");

  const res = fakeRes();

  await handler({ params: { slug: "iem" } }, res);

  return res.zapis;
}

test("nieznany turniej konczy sie po jednym zapytaniu", async () => {
  const pool = fakePool(() => []);

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 404);
  assert.equal(pool.wywolania.length, 1, "po 404 nie ma czego dopytywac");
});

test("statystyki turnieju ida jedna fala", async () => {
  // To jest cala poprawka. Wczesniej bylo tych zapytan jedenascie, jedno po
  // drugim, chociaz zadne nie potrzebuje wyniku zadnego innego - jedyna
  // prawdziwa zaleznosc to event.id, odczytany w fali pierwszej.
  const pool = fakePool(odpowiedzDomyslna);

  await wywolaj({ pool });

  const poEvencie = pool.wywolania.filter((w) => w.fala > 1);

  assert.equal(
    poEvencie.length,
    10,
    `oczekiwano 10 zapytan o statystyki, bylo ${poEvencie.length}`,
  );

  assert.equal(pool.fal, 2, "turniej, a potem wszystko naraz");
});

test("dociaganie nazw graczy nie rozbija sie na osobne podroze", async () => {
  // resolveDisplayName siega do bazy tylko wtedy, gdy gracza nie ma
  // w profilach. Wczesniej te trzy wywolania stały w srodku res.json({...})
  // jako osobne `await`, wiec w takim przypadku doklejaly trzy kolejne
  // podroze na sam koniec odpowiedzi.
  const pool = fakePool((sql) => {
    if (sql.includes("FROM events")) return [EVENT];

    // Kazde zapytanie o "najlepszego" oddaje gracza BEZ nazwy z profilu -
    // dokladnie ten przypadek, w ktorym trzeba dopytac.
    if (sql.includes("SUM(mp.points)")) {
      return [{ user_id: "u1", displayname: null, total_points: 10 }];
    }

    if (sql.includes("exact_maps")) {
      return [{ user_id: "u2", displayname: null, exact_maps: 3 }];
    }

    if (sql.includes("accuracy")) {
      return [{ user_id: "u3", displayname: null, accuracy: 50 }];
    }

    return [];
  });

  const zapytaniaONazwy = [];

  const zapis = await wywolaj({
    pool,
    resolveDisplayName: async (eventId, row) => {
      zapytaniaONazwy.push(row?.user_id);

      return row?.user_id ? `nick-${row.user_id}` : null;
    },
  });

  assert.equal(zapis.kod, 200);

  assert.equal(
    zapytaniaONazwy.length,
    3,
    "trzy wyroznione miejsca, trzy nazwy",
  );

  // Fala 1: turniej. Fala 2: statystyki. Nazwy licza sie razem z fala 2
  // albo tworza trzecia - ale NIE piata, szosta i siodma.
  assert.ok(
    pool.fal <= 3,
    `oczekiwano najwyzej trzech fal, bylo ${pool.fal}`,
  );
});
