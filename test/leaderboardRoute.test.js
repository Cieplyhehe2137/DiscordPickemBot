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

// --- druga os tabeli: skutecznosc -------------------------------------------
//
// Punkty rosna z kazdym oddanym typem, wiec ranking punktowy w duzej mierze
// mierzy OBECNOSC. Zmierzone w IEM Cologne na 106 rozstrzygnietych meczach:
// mediana typujacego pominela 103 z nich, a 163 osoby oddaly dokladnie jeden
// typ. Przelacznik uklada tych samych ludzi po odsetku trafien.

// Ranking z trzema osobami: obecny (duzo typow, srednie oko), celny (polowa
// typow, najlepsze oko) i przypadkowy (jeden typ, komplet trafien).
function POLE(sql) {
  if (toOdczytTurnieju(sql)) return [{ id: 7 }];

  if (sql.includes("COUNT(*) AS ile")) return [{ ile: 10 }];

  if (sql.includes("FROM leaderboard lb")) {
    return [
      {
        user_id: "obecny",
        total_points: 300,
        total_predictions: 10,
        correct_winners: 6,
      },
      {
        user_id: "celny",
        total_points: 120,
        total_predictions: 5,
        correct_winners: 4,
      },
      {
        user_id: "przypadkowy",
        total_points: 30,
        total_predictions: 1,
        correct_winners: 1,
      },
    ];
  }

  return [];
}

test("bez parametru tabela zostaje punktowa", async () => {
  const zapis = await wywolaj({ pool: fakePool(POLE) });

  assert.equal(zapis.tresc.porzadek, "punkty");
  assert.deepEqual(
    zapis.tresc.leaderboard.map((w) => w.user_id),
    ["obecny", "celny", "przypadkowy"],
  );
});

test("porzadek=skutecznosc uklada po odsetku trafien, nie po punktach", async () => {
  const zapis = await wywolaj({
    pool: fakePool(POLE),
    query: { porzadek: "skutecznosc" },
  });

  assert.equal(zapis.tresc.porzadek, "skutecznosc");

  assert.deepEqual(
    zapis.tresc.leaderboard.map((w) => w.user_id),
    ["celny", "obecny"],
    "80% nad 60%, a jednorazowy nie dobil do progu",
  );

  assert.equal(zapis.tresc.leaderboard[0].rank, 1, "miejsce nadane od nowa");
  assert.equal(
    zapis.tresc.leaderboard[0].points_rank,
    2,
    "i zapamietane punktowe - po to sie tu przychodzi",
  );
});

test("SORTUJE SERWER, bo front dostaje tylko jedna strone", async () => {
  // To jest cala przyczyna, dla ktorej ten porzadek jest parametrem trasy,
  // a nie przelacznikiem w przegladarce. Przy 523 sklasyfikowanych front
  // widzi piecdziesiat wierszy; przestawienie ich u siebie uloziloby
  // WYLACZNIE te piecdziesiat i "pierwszy w skutecznosci" znaczyloby
  // "pierwszy na tej stronie".
  const zapis = await wywolaj({
    pool: fakePool(POLE),
    query: { porzadek: "skutecznosc", naStronie: "1", strona: "1" },
  });

  assert.equal(zapis.tresc.leaderboard.length, 1, "jeden wiersz na stronie");
  assert.equal(
    zapis.tresc.leaderboard[0].user_id,
    "celny",
    "na pierwszej stronie stoi najlepszy z CALEJ stawki",
  );
  assert.equal(zapis.tresc.strony.wRankingu, 2, "strony liczy sie ze stawki");
  assert.equal(zapis.tresc.strony.ile, 2);
});

test("stawka i prog ida w odpowiedzi, zeby dalo sie je wyjasnic", async () => {
  const zapis = await wywolaj({ pool: fakePool(POLE) });

  assert.equal(zapis.tresc.skutecznosc.threshold, 5, "polowa z dziesieciu meczow");
  assert.equal(zapis.tresc.skutecznosc.players, 2, "jednorazowy odpada");
});

test("szukanie w widoku skutecznosci przeszukuje TE tabele", async () => {
  // Inaczej wyszukiwarka znajdowalaby ludzi, ktorych na ekranie nie ma -
  // i odsylala na strone, ktora ich nie zawiera.
  const zapis = await wywolaj({
    pool: fakePool(POLE),
    query: { porzadek: "skutecznosc", szukaj: "przypadkowy" },
  });

  assert.equal(zapis.tresc.leaderboard.length, 0);
  assert.equal(zapis.tresc.strony.wszystkich, 0);
});

test("\"Znajdz mnie\" kogos spoza stawki mowi o tym wprost", async () => {
  // Bez tej flagi guzik wyglada na zepsuty: nic sie nie dzieje, bo gracza
  // w tej tabeli po prostu nie ma.
  const pozaStawka = await wywolaj({
    pool: fakePool(POLE),
    query: { porzadek: "skutecznosc", znajdz: "przypadkowy" },
  });

  assert.equal(pozaStawka.tresc.strony.pozaStawka, true);

  const wStawce = await wywolaj({
    pool: fakePool(POLE),
    query: { porzadek: "skutecznosc", znajdz: "celny" },
  });

  assert.equal(wStawce.tresc.strony.pozaStawka, false);
});

test("turniej bez rozstrzygnietych meczow nie daje sie przelaczyc", async () => {
  // StarLadder Budapest 2025: 509 graczy, zero meczow. Prosba o skutecznosc
  // ma wrocic tabela punktowa, a nie pustka.
  const bezMeczow = (sql) => {
    if (toOdczytTurnieju(sql)) return [{ id: 7 }];

    if (sql.includes("COUNT(*) AS ile")) return [{ ile: 0 }];

    if (sql.includes("FROM leaderboard lb")) {
      return [{ user_id: "ktos", total_points: 47, total_predictions: 0 }];
    }

    return [];
  };

  const zapis = await wywolaj({
    pool: fakePool(bezMeczow),
    query: { porzadek: "skutecznosc" },
  });

  assert.equal(zapis.tresc.porzadek, "punkty", "nie ma czego przelaczyc");
  assert.equal(zapis.tresc.skutecznosc.players, 0);
  assert.equal(zapis.tresc.leaderboard.length, 1, "tabela punktowa stoi");
});

test("przelaczenie osi NIE psuje tabeli punktowej", async () => {
  // Wiersze rankingu punktowego siedza w pamieci podrecznej i sa tymi samymi
  // obiektami. Gdyby uklad skutecznosci nadpisal im `rank`, pierwsze wejscie
  // na druga os rozwalaloby pierwsza - i to do nastepnego odswiezenia cache'u,
  // czyli dla wszystkich odwiedzajacych.
  const { registerEventRoutes } = await import(MODUL);
  const { createParticipantQueries } = await import(UCZESTNICY);

  const pool = fakePool(POLE);
  const app = fakeApp();

  registerEventRoutes(app, {
    pool,
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

  // Ta sama pamiec podreczna obsluguje oba wywolania - drugie nie idzie
  // juz do bazy.
  const poSkutecznosci = fakeRes();

  await handler(
    { params: { slug: "iem" }, query: { porzadek: "skutecznosc" } },
    poSkutecznosci,
  );

  const poPunktach = fakeRes();

  await handler({ params: { slug: "iem" }, query: {} }, poPunktach);

  assert.deepEqual(
    poPunktach.zapis.tresc.leaderboard.map((w) => [w.user_id, w.rank]),
    [
      ["obecny", 1],
      ["celny", 2],
      ["przypadkowy", 3],
    ],
    "tabela punktowa ma te same miejsca co przed przelaczeniem",
  );
});
