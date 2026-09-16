// Trasa rankingu (server/routes/events.js).
//
// Jak przy statystykach turnieju: test liczy PODROZE do bazy, a nie
// milisekundy. Zmierzone na produkcyjnej bazie, po rozgrzewce, kazde
// zapytanie osobno:
//
//   SELECT id FROM events (trywialne)   172 ms  <- tyle kosztuje sama podroz
//   glowny ranking, 523 wiersze         260 ms
//   rozbicie punktow na fazy            200 ms
//   statystyki map                      220 ms
//
// Trywialne zapytanie kosztuje 172 ms, wiec PRACA trzech ciezkich to 30-90 ms
// kazde. Reszta to podroz. Nawet zlaczenie osmiu tabel przez UNION - to, ktore
// w kodzie wyglada najgrozniej - kosztuje ledwie 90 ms ponad podroz.
//
// Trzy ciezkie sa kluczowane wylacznie na event.id, wiec nie potrzebuja sie
// nawzajem i moga isc razem.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/events.js";

function fakeApp() {
  const trasy = new Map();
  const nic = () => {};

  return {
    trasy,
    get(sciezka, handler) {
      trasy.set(`GET ${sciezka}`, handler);
    },
    post: nic,
    put: nic,
    patch: nic,
    delete: nic,
    use: nic,
  };
}

// Atrapa puli liczaca fale. Fala to zestaw zapytan wystrzelonych, zanim
// ktorekolwiek z nich zdazylo wrocic.
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

const nic = () => {};
const nicAsync = async () => {};

async function wywolaj({ pool }) {
  const { registerEventRoutes } = await import(MODUL);

  const app = fakeApp();

  registerEventRoutes(app, {
    pool,
    countParticipants: nicAsync,
    VALID_PHASES: [],
    assertPredictionsAllowed: async () => ({ allowed: true }),
    emitDashboardRefresh: nic,
    findPanelForDeadline: nicAsync,
    findPanelForMatchDeadline: nicAsync,
    getEventPickemConfig: nicAsync,
    getOpenEventId: nicAsync,
    guildIdFromEventSlug: nicAsync,
    guildRegistry: {},
    hasAdminPermission: () => true,
    io: { emit: nic },
    normalizePhase: (p) => p,
    parseDeadlineInput: nic,
    checkPickemGate: async () => ({ allowed: true }),
    registerGuildRoutes: nic,
    requireGuildAdmin: () => nic,
    buildMatchesWithPickSql: () => "",
  });

  const handler = app.trasy.get("GET /api/events/:slug/leaderboard");

  assert.ok(handler, "trasa rankingu musi byc zarejestrowana");

  const res = fakeRes();

  // Handler czyta req.query.naStronie i req.query.szukaj - bez pustego
  // obiektu leci wyjatkiem, a test mierzylby odpowiedz bledu.
  await handler({ params: { slug: "iem" }, query: {} }, res);

  return res.zapis;
}

test("nieznany turniej konczy sie po jednym zapytaniu", async () => {
  const pool = fakePool(() => []);

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 404);
  assert.equal(pool.wywolania.length, 1, "po 404 nie ma czego dopytywac");
});

test("ranking idzie jedna fala", async () => {
  const pool = fakePool((sql) => (sql.includes("FROM events") ? [{ id: 7 }] : []));

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 200);

  const poEvencie = pool.wywolania.filter((w) => w.fala > 1);

  assert.equal(
    poEvencie.length,
    3,
    `oczekiwano 3 zapytan o ranking, bylo ${poEvencie.length}`,
  );

  assert.equal(pool.fal, 2, "turniej, a potem wszystko naraz");
});

test("odpowiedz ma ksztalt strony rankingu", async () => {
  // Kontrola, ze fala nie pogubila wynikow po drodze: pusta baza ma dac
  // pusta liste i sensowne stronicowanie, a nie wyjatek.
  const pool = fakePool((sql) => (sql.includes("FROM events") ? [{ id: 7 }] : []));

  const zapis = await wywolaj({ pool });

  assert.ok(zapis.tresc, "brak tresci odpowiedzi");
  assert.ok(Array.isArray(zapis.tresc.leaderboard), "leaderboard ma byc tablica");
  assert.equal(zapis.tresc.leaderboard.length, 0);
});
