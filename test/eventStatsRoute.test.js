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

const EVENT = { id: 7, guild_id: "g1" };

// PUŁAPKA: od czasu przejscia na podzapytanie po slugu KAZDE zapytanie tej
// trasy zawiera "FROM events" - w srodku "(SELECT id FROM events WHERE slug
// = ?)". Rozpoznawanie odczytu turnieju po tym napisie dawalo wiersz turnieju
// w odpowiedzi na kazde zapytanie i test milczaco mierzyl bzdury.
//
// Sam odczyt turnieju jest jedynym, ktory ZACZYNA sie od "SELECT id".
function toOdczytTurnieju(sql) {
  return /^\s*SELECT\s+id\b/.test(sql);
}

function odpowiedzDomyslna(sql) {
  if (toOdczytTurnieju(sql)) return [EVENT];

  return [];
}

async function wywolaj({
  pool,
  resolveDisplayName = async () => null,
  // Atrapy do nadpisania. Domyslne odpowiadaja turniejowi ZAKONCZONEMU -
  // wtedy petla po meczach i tak ich nie wola.
  assertPredictionsAllowed = async () => ({ allowed: true }),
  isMatchDeadlinePassed = async () => ({ passed: false }),
  matchPanelPhaseFor = () => null,
}) {
  const { registerEventStatsRoutes } = await import(MODUL);

  const app = fakeApp();

  registerEventStatsRoutes(app, {
    pool,
    resolveDisplayName,
    assertPredictionsAllowed,
    isMatchDeadlinePassed,
    isMatchLocked: () => false,
    matchPanelPhaseFor,
  });

  const handler = app.trasy.get("GET /api/events/:slug/stats");

  assert.ok(handler, "trasa statystyk musi byc zarejestrowana");

  const res = fakeRes();

  await handler({ params: { slug: "iem" } }, res);

  return res.zapis;
}

test("nieznany turniej nadal konczy sie czterystaczwórką", async () => {
  // Swiadomy koszt jednej fali: przy nieznanym slugu pozostale zapytania i tak
  // poleca, bo ida rownolegle z odczytem turnieju. Podzapytanie daje wtedy
  // NULL, wiec nie znajduja nic. Placimy zmarnowana praca w przypadku rzadkim,
  // zeby nie placic okrazenia w kazdym normalnym.
  const pool = fakePool(() => []);

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 404);
  assert.equal(pool.fal, 1, "nawet niepotrzebna praca ma sie zmiescic w jednej fali");
});

test("statystyki turnieju ida JEDNA fala", async () => {
  // Wczesniej bylo tych zapytan jedenascie, jedno po drugim. Potem wszystkie
  // naraz, ale wciaz za osobnym odczytem turnieju. Teraz odczyt jedzie razem
  // z nimi, a turniej wybiera sie slugiem.
  const pool = fakePool(odpowiedzDomyslna);

  await wywolaj({ pool });

  assert.equal(
    pool.wywolania.length,
    11,
    `oczekiwano 11 zapytan, bylo ${pool.wywolania.length}`,
  );

  assert.equal(pool.fal, 1, `oczekiwano jednej fali, bylo ${pool.fal}`);
});

test("turniej wybiera sie slugiem, a nie osobno odczytanym identyfikatorem", async () => {
  const pool = fakePool(odpowiedzDomyslna);

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

// --- bramka i terminy w petli ----------------------------------------------
//
// Przy turnieju ZAKONCZONYM kazdy mecz jest rozstrzygniety, wiec warunek
// omija obie funkcje i w pomiarach nie widac niczego. Usterka wychodzi
// dopiero przy turnieju TRWAJACYM - czyli wtedy, gdy na stronie jest ruch.

function otwarteMecze(ile) {
  return Array.from({ length: ile }, (_, i) => ({
    match_id: i + 1,
    team_a: "A",
    team_b: "B",
    phase: i % 2 === 0 ? "SWISS_STAGE1" : "PLAYOFFS",
    best_of: 3,
    finished: 0,
    is_locked: 0,
    lock_override: null,
    total_picks: 10,
    team_a_picks: 5,
    team_b_picks: 5,
  }));
}

test("bramka typowania pytana RAZ, a nie przy kazdym meczu", async () => {
  const MECZOW = 20;

  const pool = fakePool((sql) => {
    if (sql.includes("FROM events")) return [EVENT];

    if (sql.includes("total_picks")) return otwarteMecze(MECZOW);

    return [];
  });

  let bramek = 0;

  await wywolaj({
    pool,
    assertPredictionsAllowed: async () => {
      bramek += 1;

      return { allowed: true };
    },
  });

  assert.equal(
    bramek,
    1,
    `bramka pytana ${bramek} razy przy ${MECZOW} otwartych meczach`,
  );
});

test("termin liczony raz na FAZE, a nie raz na mecz", async () => {
  // Termin zalezy od fazy panelu, wiec przy dwudziestu meczach z dwoch faz
  // maja wyjsc dwa sprawdzenia, nie dwadziescia.
  const pool = fakePool((sql) => {
    if (sql.includes("FROM events")) return [EVENT];

    if (sql.includes("total_picks")) return otwarteMecze(20);

    return [];
  });

  const fazy = [];

  await wywolaj({
    pool,
    assertPredictionsAllowed: async () => ({ allowed: true }),
    matchPanelPhaseFor: (faza) => faza,
    isMatchDeadlinePassed: async (_pool, _guild, faza) => {
      fazy.push(faza);

      return { passed: false };
    },
  });

  assert.equal(
    fazy.length,
    new Set(fazy).size,
    `ta sama faza sprawdzana wiecej niz raz: ${fazy.join(", ")}`,
  );

  assert.ok(fazy.length <= 2, `oczekiwano najwyzej dwoch faz, bylo ${fazy.length}`);
});
