// Trasa rankingu (server/routes/events.js).
//
// Test liczy PODROZE do bazy, a nie milisekundy. Zmierzone na serwerze przez
// healthcheck: jedna podroz to 177 ms, dziesiec prob, zerowy rozrzut. Kazda
// fala to jedno takie okrazenie, za ktore placi kazdy wchodzacy.
//
// Trasa miala ich TRZY: odczyt turnieju, potem cztery zapytania rankingu,
// potem liczba uczestnikow. Drugie i trzecie nie potrzebowaly niczyjego
// wyniku - pierwsze sluzylo wylacznie zamianie sluga na event.id.
//
// Teraz wszystko idzie jedna fala: pozostale zapytania biora turniej
// podzapytaniem po slugu, ktore kosztuje tyle co nic (zmierzone na tych
// wlasnie zapytaniach: roznice od -16 do +12 ms).

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/events.js";
const UCZESTNICY = "../server/lib/participants.js";

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

// PUŁAPKA: od czasu przejscia na podzapytanie po slugu KAZDE zapytanie tej
// trasy zawiera "FROM events" - w srodku "(SELECT id FROM events WHERE slug
// = ?)". Rozpoznawanie odczytu turnieju po tym napisie dawalo wiersz turnieju
// w odpowiedzi na kazde zapytanie i test milczaco mierzyl bzdury.
//
// Sam odczyt turnieju jest jedynym, ktory ZACZYNA sie od "SELECT id".
function toOdczytTurnieju(sql) {
  return /^\s*SELECT\s+id\s*\n/.test(sql);
}

const nic = () => {};
const nicAsync = async () => {};

async function wywolaj({ pool, query = {} }) {
  const { registerEventRoutes } = await import(MODUL);
  const { createParticipantQueries } = await import(UCZESTNICY);

  const app = fakeApp();

  registerEventRoutes(app, {
    pool,

    // Przez te sama atrape puli, bo countParticipants robi WLASNE zapytanie -
    // i dopoki stalo za fala, bylo trzecim okrazeniem.
    countParticipants: (we) => createParticipantQueries(pool).countParticipants(we),

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
  await handler({ params: { slug: "iem" }, query }, res);

  return res.zapis;
}

const ZNANY = (sql) => (toOdczytTurnieju(sql) ? [{ id: 7 }] : []);

test("ranking idzie JEDNA fala", async () => {
  const pool = fakePool(ZNANY);

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 200);

  assert.equal(pool.fal, 1, `oczekiwano jednej fali, bylo ${pool.fal}`);

  assert.ok(
    pool.wywolania.length >= 5,
    `oczekiwano co najmniej pieciu zapytan, bylo ${pool.wywolania.length}`,
  );

  assert.ok(
    pool.wywolania.every((w) => w.fala === 1),
    "jakies zapytanie wypadlo poza pierwsza fale",
  );
});

test("liczba uczestnikow liczy sie razem z reszta, nie po niej", async () => {
  const pool = fakePool(ZNANY);

  await wywolaj({ pool });

  const uczestnicy = pool.wywolania.find((w) =>
    w.sql.includes("COUNT(DISTINCT user_id) AS uczestnicy"),
  );

  assert.ok(uczestnicy, "brak zapytania o uczestnikow");
  assert.equal(uczestnicy.fala, 1, "zapytanie o uczestnikow to osobne okrazenie");
});

test("turniej wybiera sie slugiem, a nie osobno odczytanym identyfikatorem", async () => {
  const pool = fakePool(ZNANY);

  await wywolaj({ pool });

  const poOdczycie = pool.wywolania.filter((w) => !toOdczytTurnieju(w.sql));

  assert.ok(poOdczycie.length > 0, "brak zapytan poza odczytem turnieju");

  for (const w of poOdczycie) {
    assert.ok(
      w.sql.includes("(SELECT id FROM events WHERE slug = ? LIMIT 1)"),
      `zapytanie nie bierze turnieju ze sluga: ${w.sql.slice(0, 70)}`,
    );
  }
});

test("nieznany turniej nadal konczy sie czterystaczwórką", async () => {
  // Swiadomy koszt jednej fali: przy nieznanym slugu pozostale zapytania i tak
  // poleca, bo ida rownolegle z odczytem turnieju. Podzapytanie daje wtedy
  // NULL, wiec nie znajduja nic. Placimy zmarnowana praca w przypadku, ktory
  // zdarza sie rzadko, zeby nie placic okrazenia w kazdym normalnym.
  const pool = fakePool(() => []);

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 404);
  assert.equal(pool.fal, 1, "nawet niepotrzebna praca ma sie zmiescic w jednej fali");
});

test("nazwy z faz ida osobnym zapytaniem, nie zlaczeniem", async () => {
  // Wczesniej bylo to zlaczenie tabeli pochodnej, dolaczanej warunkiem
  // z CAST na lb.user_id - a CAST na kolumnie odcina baze od indeksu.
  const pool = fakePool(ZNANY);

  await wywolaj({ pool });

  const glowne = pool.wywolania.find((w) => w.sql.includes("FROM leaderboard lb"));

  assert.ok(glowne, "brak glownego zapytania");

  assert.equal(
    /\n\s+= CAST\(lb\.user_id AS CHAR/.test(glowne.sql),
    false,
    "wrocil warunek zlaczenia z CAST na lb.user_id",
  );

  assert.ok(
    pool.wywolania.some(
      (w) => w.sql.includes("MAX(nazwa)") && !w.sql.includes("FROM leaderboard lb"),
    ),
    "brak osobnego zapytania o nazwy",
  );
});

test("nazwa gracza spada po kolei: profil, potem typy, na koncu id", async () => {
  // Zachowanie, ktore wczesniej dawal COALESCE w SQL-u, a teraz sklejenie
  // w JS. Gracz typujacy WYLACZNIE na Discordzie nie ma wiersza
  // w user_profiles - jego nazwa lezy w tabelach faz.
  const pool = fakePool((sql) => {
    if (toOdczytTurnieju(sql)) return [{ id: 7 }];

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
  const pool = fakePool(ZNANY);

  const zapis = await wywolaj({ pool });

  assert.ok(zapis.tresc, "brak tresci odpowiedzi");
  assert.ok(Array.isArray(zapis.tresc.leaderboard), "leaderboard ma byc tablica");
  assert.equal(zapis.tresc.leaderboard.length, 0);
  assert.equal(zapis.tresc.uczestnicy, 0);
});
