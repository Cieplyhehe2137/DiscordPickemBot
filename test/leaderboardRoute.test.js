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
    4,
    `oczekiwano 4 zapytan o ranking, bylo ${poEvencie.length}`,
  );

  assert.equal(pool.fal, 2, "turniej, a potem wszystko naraz");
});

test("nazwy z faz ida osobnym zapytaniem, nie zlaczeniem", async () => {
  // Wczesniej bylo to zlaczenie tabeli pochodnej, dolaczanej warunkiem
  // z CAST na lb.user_id - a CAST na kolumnie odcina baze od indeksu.
  // Zmierzone na produkcji kosztowalo to 62-124 ms w glownym zapytaniu,
  // podczas gdy samo zebranie nazw to 4-9 ms pracy.
  const pool = fakePool((sql) => (sql.includes("FROM events") ? [{ id: 7 }] : []));

  await wywolaj({ pool });

  const glowne = pool.wywolania.find((w) => w.sql.includes("FROM leaderboard lb"));

  assert.ok(glowne, "brak glownego zapytania");

  assert.equal(
    /\n\s+= CAST\(lb\.user_id AS CHAR/.test(glowne.sql),
    false,
    "wrocil warunek zlaczenia z CAST na lb.user_id",
  );

  assert.equal(
    glowne.sql.includes("nazwy.nazwa"),
    false,
    "glowne zapytanie nadal siega po nazwe ze zlaczenia",
  );

  assert.ok(
    pool.wywolania.some(
      (w) => w.sql.includes("MAX(nazwa)") && !w.sql.includes("FROM leaderboard lb"),
    ),
    "brak osobnego zapytania o nazwy",
  );
});

test("nazwa gracza spada po kolei: profil, potem typy, na koncu id", async () => {
  // To jest zachowanie, ktore wczesniej dawal COALESCE w SQL-u, a teraz
  // sklejenie w JS. Gracz typujacy WYLACZNIE na Discordzie nie ma wiersza
  // w user_profiles - jego nazwa lezy w tabelach faz. Bez tego w rankingu
  // zakonczonego turnieju wychodzilo surowe user_id.
  const pool = fakePool((sql) => {
    if (sql.includes("FROM events")) return [{ id: 7 }];

    if (sql.includes("FROM leaderboard lb")) {
      return [
        { user_id: "z-profilem", profile_name: "Nick z profilu", total_points: 10 },
        { user_id: "z-typow", profile_name: null, total_points: 9 },
        { user_id: "znikad", profile_name: null, total_points: 8 },
      ];
    }

    if (sql.includes("MAX(nazwa)")) {
      return [
        { user_id: "z-typow", nazwa: "Nick z typow" },
        // "z-profilem" tez ma nazwe z typow - profil ma wygrac.
        { user_id: "z-profilem", nazwa: "NIE TA" },
      ];
    }

    return [];
  });

  const zapis = await wywolaj({ pool });

  const wg = new Map(
    zapis.tresc.leaderboard.map((w) => [w.user_id, w.displayname]),
  );

  assert.equal(wg.get("z-profilem"), "Nick z profilu");
  assert.equal(wg.get("z-typow"), "Nick z typow");
  assert.equal(wg.get("znikad"), "znikad", "ostatnim zapasem jest identyfikator");
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
