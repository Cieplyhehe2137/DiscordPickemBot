// Roster turnieju w panelu:
// GET  /api/events/:slug/teams
// PUT  /api/events/:slug/teams
//
// To PIERWSZY zapis do event_teams w calym repo. Etapy 1-3 przestawily odczyt
// (strona i bot pytaja o roster turnieju, a gdy go nie ma - o roster serwera),
// ale tabeli nic nie zapisywalo, wiec caly mechanizm byl bezczynny.
//
// Dlatego wiekszosc testow tutaj nie dotyczy "czy sie zapisalo", a tego, co
// moze sie zapisac ZLE:
//
//   - kolejnosc, bo sort_order rostera jest rozstawieniem turnieju i czytaja
//     go cztery dropdowny wynikow admina;
//   - pusta lista, bo w bazie "roster bez druzyn" i "brak rostera" to ten sam
//     stan, czyli zapis pustej listy KASUJE roster;
//   - obce identyfikatory, bo odczyt filtruje po guild_id i wiersz z cudza
//     druzyna byl by niewidoczny, czyli nie dalby sie odznaczyc;
//   - brak tabeli, bo migracja 0014 moze jeszcze nie pojsc.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const EVENT_TEAMS = "../server/routes/eventTeams.js";
const PANEL = path.join(
  __dirname,
  "..",
  "web",
  "src",
  "components",
  "admin",
  "EventRosterPanel.jsx",
);

const GUILD = "111";
const SLUG = "iem-cologne-major-2026";
const EVENT_ID = 37;

// Slownik serwera w kolejnosci, w ktorej go oddaje trasa: sort_order, nazwa.
const SLOWNIK = [
  { id: 5, name: "Astralis", active: 1, sort_order: 1 },
  { id: 9, name: "FaZe", active: 1, sort_order: 2 },
  { id: 2, name: "NAVI", active: 1, sort_order: 3 },
  { id: 7, name: "Heroic", active: 0, sort_order: 4 },
];

function fakeRes() {
  const zapis = { kod: 200, tresc: null };

  return {
    zapis,
    status(kod) {
      zapis.kod = kod;
      return this;
    },
    json(tresc) {
      zapis.tresc = tresc;
      return this;
    },
  };
}

function bladBrakTabeli() {
  const err = new Error("Table 'pickem.event_teams' doesn't exist");
  err.code = "ER_NO_SUCH_TABLE";
  return err;
}

/**
 * @param {object} opcje
 * @param {Array} opcje.roster wiersze event_teams (w kolejnosci sort_order)
 * @param {Array} opcje.mecze nazwy druzyn z meczow turnieju
 * @param {boolean} opcje.brakEventu czy events ma oddac pustke
 * @param {boolean} opcje.brakTabeli czy event_teams ma rzucac ER_NO_SUCH_TABLE
 */
function fakePool({
  roster = [],
  mecze = [],
  slownik = SLOWNIK,
  brakEventu = false,
  brakTabeli = false,
} = {}) {
  const zapisane = { usuniete: [], wstawione: null, transakcje: 0 };

  const conn = {
    async query(sql, params) {
      const tekst = String(sql);

      if (tekst.includes("DELETE FROM event_teams")) {
        if (brakTabeli) throw bladBrakTabeli();

        zapisane.usuniete.push(Number(params[0]));
        return [{ affectedRows: 1 }];
      }

      if (tekst.includes("INSERT INTO event_teams")) {
        if (brakTabeli) throw bladBrakTabeli();

        zapisane.wstawione = params[0];
        return [{ affectedRows: params[0].length }];
      }

      throw new Error(`nieoczekiwane zapytanie w transakcji: ${tekst}`);
    },
  };

  return {
    zapisane,
    conn,
    _transakcja() {
      zapisane.transakcje += 1;
    },
    async query(sql, params) {
      const tekst = String(sql);

      if (tekst.includes("FROM events")) {
        return [brakEventu ? [] : [{ id: EVENT_ID }]];
      }

      if (tekst.includes("FROM event_teams")) {
        if (brakTabeli) throw bladBrakTabeli();

        return [roster.map((id) => ({ id }))];
      }

      // Kontrola przy zapisie - ta sama tabela, inne pytanie.
      if (tekst.includes("id IN (?)")) {
        const podane = params[1].map(Number);

        return [
          slownik.filter((d) => podane.includes(d.id)).map((d) => ({ id: d.id })),
        ];
      }

      if (tekst.includes("FROM teams")) {
        return [slownik];
      }

      if (tekst.includes("FROM matches")) {
        return [mecze.map((name) => ({ name }))];
      }

      throw new Error(`nieoczekiwane zapytanie: ${tekst}`);
    },
  };
}

async function trasy(pool) {
  const { registerEventTeamsRoutes } = await import(EVENT_TEAMS);

  const zlapane = { get: null, put: null };

  const app = {
    get(sciezka, ...reszta) {
      if (sciezka === "/api/events/:slug/teams") {
        zlapane.get = reszta[reszta.length - 1];
      }
    },
    put(sciezka, ...reszta) {
      if (sciezka === "/api/events/:slug/teams") {
        zlapane.put = reszta[reszta.length - 1];
      }
    },
    post() {},
    patch() {},
    delete() {},
  };

  registerEventTeamsRoutes(app, {
    pool,
    requireGuildAdmin: () => () => {},
    guildIdFromEventSlug: () => GUILD,
    logInfo: () => {},
    async runInTransaction(p, fn) {
      p._transakcja();
      return fn(p.conn);
    },
  });

  assert.ok(zlapane.get, "nie znaleziono GET /api/events/:slug/teams");
  assert.ok(zlapane.put, "nie znaleziono PUT /api/events/:slug/teams");

  return zlapane;
}

function zadanie(body) {
  return { params: { slug: SLUG }, guildId: GUILD, body };
}

/* === ODCZYT ============================================================== */

test("turniej bez rostera: hasRoster false i caly slownik serwera", async () => {
  const pool = fakePool();
  const { get } = await trasy(pool);
  const res = fakeRes();

  await get(zadanie(), res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(res.zapis.tresc.hasRoster, false);
  assert.deepEqual(res.zapis.tresc.teamIds, []);

  // Wylaczona druzyna ZOSTAJE na liscie - wylaczenie po turnieju nie moze jej
  // usunac z turnieju, w ktorym zagrala. To jest caly powod tego rostera.
  assert.deepEqual(
    res.zapis.tresc.teams.map((d) => [d.id, d.active]),
    [
      [5, true],
      [9, true],
      [2, true],
      [7, false],
    ],
  );
});

test("turniej z rosterem oddaje go w kolejnosci z zapytania", async () => {
  const pool = fakePool({ roster: [9, 2, 5] });
  const { get } = await trasy(pool);
  const res = fakeRes();

  await get(zadanie(), res);

  assert.equal(res.zapis.tresc.hasRoster, true);
  assert.deepEqual(res.zapis.tresc.teamIds, [9, 2, 5]);
});

test("nazwy z meczow przelozone na identyfikatory, nieznane osobno", async () => {
  const pool = fakePool({ mecze: ["NAVI", "FaZe", "DFGDFGDFGS"] });
  const { get } = await trasy(pool);
  const res = fakeRes();

  await get(zadanie(), res);

  assert.deepEqual(res.zapis.tresc.matchTeamIds, [2, 9]);

  // Mecze wpisuje sie tekstem, wiec nazwa bez wiersza w slowniku NIE jest
  // bledem danych - ale rostera z niej nie zlozysz, wiec panel ma ja wymienic.
  assert.deepEqual(res.zapis.tresc.unknownMatchNames, ["DFGDFGDFGS"]);
});

test("nazwa z meczu trafia w druzyne przez teamKey, nie przez rownosc napisow", async () => {
  // Oba przypadki sa z produkcji, z meczow IEM Cologne Major 2026: mecze
  // maja "BetBoom", a slownik "BETBOOM"; mecze maja "NAVI", a slownik
  // "Natus Vincere". Porownanie doslowne zglaszalo obie jako nieznane,
  // mimo ze STRONA liczy je jako jedna druzyne (server/lib/teamLogos.js).
  const slownik = [
    { id: 11, name: "BETBOOM", active: 1, sort_order: 1 },
    { id: 12, name: "Natus Vincere", active: 1, sort_order: 2 },
    { id: 13, name: "FaZe Clan", active: 1, sort_order: 3 },
  ];

  const pool = fakePool({
    slownik,
    mecze: ["BetBoom", "NAVI", "FaZe", "Astralis"],
  });

  const { get } = await trasy(pool);
  const res = fakeRes();

  await get(zadanie(), res);

  assert.deepEqual(res.zapis.tresc.matchTeamIds, [11, 12, 13]);

  // Astralis NIE ma wiersza w slowniku, wiec zostaje nieznana - teamKey
  // scala warianty nazwy, a nie dopisuje brakujacych druzyn.
  assert.deepEqual(res.zapis.tresc.unknownMatchNames, ["Astralis"]);
});

test("dwie nazwy jednej druzyny daja JEDEN identyfikator", async () => {
  // Inaczej skrot "wez z meczow" podawal by to samo id dwa razy, a zapis
  // rostera odrzuca powtorzenia bledem 400 - czyli przycisk prowadzilby
  // prosto w komunikat o bledzie.
  const slownik = [{ id: 12, name: "Natus Vincere", active: 1, sort_order: 1 }];

  const pool = fakePool({ slownik, mecze: ["NAVI", "Natus Vincere"] });
  const { get } = await trasy(pool);
  const res = fakeRes();

  await get(zadanie(), res);

  assert.deepEqual(res.zapis.tresc.matchTeamIds, [12]);
});

test("brak tabeli to nie awaria odczytu: tableMissing i reszta odpowiedzi", async () => {
  const pool = fakePool({ brakTabeli: true, mecze: ["NAVI"] });
  const { get } = await trasy(pool);
  const res = fakeRes();

  await get(zadanie(), res);

  assert.equal(res.zapis.kod, 200, "migracja 0014 moze jeszcze nie pojsc");
  assert.equal(res.zapis.tresc.tableMissing, true);
  assert.equal(res.zapis.tresc.hasRoster, false);
  assert.equal(res.zapis.tresc.teams.length, 4);
  assert.deepEqual(res.zapis.tresc.matchTeamIds, [2]);
});

test("KAZDY INNY blad bazy idzie w gore jako 500, nie jako 'brak rostera'", async () => {
  // Potraktowanie awarii bazy jako "ten turniej nie ma rostera" dawaloby po
  // cichu INNA liste druzyn - dokladnie to samo rozroznienie pilnuje
  // utils/loadEventTeams.js przy odczycie.
  const pool = fakePool();
  const oryginalny = pool.query.bind(pool);

  pool.query = async (sql, params) => {
    if (String(sql).includes("FROM event_teams")) {
      const err = new Error("Lock wait timeout exceeded");
      err.code = "ER_LOCK_WAIT_TIMEOUT";
      throw err;
    }

    return oryginalny(sql, params);
  };

  const { get } = await trasy(pool);
  const res = fakeRes();

  await get(zadanie(), res);

  assert.equal(res.zapis.kod, 500);
  assert.equal(res.zapis.tresc.code, "server.dbError");
});

test("odczyt nieistniejacego turnieju to 404, a nie puste dane", async () => {
  const pool = fakePool({ brakEventu: true });
  const { get } = await trasy(pool);
  const res = fakeRes();

  await get(zadanie(), res);

  assert.equal(res.zapis.kod, 404);
  assert.equal(res.zapis.tresc.code, "server.eventNotFound");
});

/* === ZAPIS =============================================================== */

test("sort_order to POZYCJA w przyslanej liscie, czyli rozstawienie", async () => {
  const pool = fakePool();
  const { put } = await trasy(pool);
  const res = fakeRes();

  // Kolejnosc slownika serwera: Astralis(5), FaZe(9), NAVI(2).
  await put(zadanie({ teamIds: [5, 9, 2] }), res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(res.zapis.tresc.saved, 3);
  assert.equal(res.zapis.tresc.cleared, false);

  assert.deepEqual(pool.zapisane.usuniete, [EVENT_ID], "podmiana, nie dokladanie");
  assert.equal(pool.zapisane.transakcje, 1);

  // To jest wlasciwosc, na ktorej stoi caly etap: roster zapisany
  // w kolejnosci slownika daje te same listy, co zapas, wiec wskazanie
  // rostera nie przestawia nikomu czterech dropdownow admina.
  assert.deepEqual(pool.zapisane.wstawione, [
    [EVENT_ID, 5, 1],
    [EVENT_ID, 9, 2],
    [EVENT_ID, 2, 3],
  ]);
});

test("inna kolejnosc zadania to inne rozstawienie - nic nie jest sortowane", async () => {
  const pool = fakePool();
  const { put } = await trasy(pool);
  const res = fakeRes();

  await put(zadanie({ teamIds: [2, 5] }), res);

  assert.deepEqual(pool.zapisane.wstawione, [
    [EVENT_ID, 2, 1],
    [EVENT_ID, 5, 2],
  ]);
});

test("pusta lista KASUJE roster: usuniecie bez wstawiania", async () => {
  const pool = fakePool({ roster: [5, 9] });
  const { put } = await trasy(pool);
  const res = fakeRes();

  await put(zadanie({ teamIds: [] }), res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(res.zapis.tresc.saved, 0);
  assert.equal(res.zapis.tresc.cleared, true, "to nie jest zapisany pusty roster");

  assert.deepEqual(pool.zapisane.usuniete, [EVENT_ID]);
  assert.equal(pool.zapisane.wstawione, null);
});

test("teamIds, ktore nie jest tablica, to 400 z kodem", async () => {
  const pool = fakePool();
  const { put } = await trasy(pool);

  for (const body of [{}, { teamIds: null }, { teamIds: "5,9" }, { teamIds: 5 }]) {
    const res = fakeRes();

    await put(zadanie(body), res);

    assert.equal(res.zapis.kod, 400, JSON.stringify(body));
    assert.equal(res.zapis.tresc.code, "server.teamIdsArray");
  }

  assert.deepEqual(pool.zapisane.usuniete, [], "zadne z tych zadan nie dotknelo bazy");
});

test("powtorzenia i smiec sa ODRZUCANE, a nie po cichu poprawiane", async () => {
  const pool = fakePool();
  const { put } = await trasy(pool);

  // Cicha korekta jest tu najgorszym wyjsciem: admin zapisuje dwadziescia
  // cztery druzyny, dostaje 200 i nie wie, ze w rosterze stoi dziewietnascie.
  for (const teamIds of [[5, 5, 9], [5, 0], [5, -2], [5, "FaZe"], [5, null]]) {
    const res = fakeRes();

    await put(zadanie({ teamIds }), res);

    assert.equal(res.zapis.kod, 400, JSON.stringify(teamIds));
    assert.equal(res.zapis.tresc.code, "server.rosterInvalidIds");
  }

  assert.deepEqual(pool.zapisane.usuniete, []);
});

test("druzyna z innego serwera nie wchodzi do rostera", async () => {
  const pool = fakePool();
  const { put } = await trasy(pool);
  const res = fakeRes();

  // 404 nie ma w slowniku tego serwera. Bez tej kontroli wiersz by wszedl,
  // a odczyt (filtrowany po guild_id) by go nie pokazal - czyli nie dalby
  // sie odznaczyc.
  await put(zadanie({ teamIds: [5, 404] }), res);

  assert.equal(res.zapis.kod, 400);
  assert.equal(res.zapis.tresc.code, "server.rosterForeignTeams");
  assert.equal(res.zapis.tresc.teams, "404");

  assert.deepEqual(pool.zapisane.usuniete, [], "nic nie zostalo podmienione");
});

test("lista ponad limit jest odrzucana przed dotknieciem bazy", async () => {
  const pool = fakePool();
  const { put } = await trasy(pool);
  const res = fakeRes();

  const teamIds = Array.from({ length: 201 }, (_, i) => i + 1);

  await put(zadanie({ teamIds }), res);

  assert.equal(res.zapis.kod, 400);
  assert.equal(res.zapis.tresc.code, "server.rosterTooBig");
  assert.equal(res.zapis.tresc.limit, 200);
  assert.deepEqual(pool.zapisane.usuniete, []);
});

test("zapis bez tabeli to 503 z nazwa migracji, a nie 500 'blad bazy'", async () => {
  const pool = fakePool({ brakTabeli: true });
  const { put } = await trasy(pool);
  const res = fakeRes();

  await put(zadanie({ teamIds: [5] }), res);

  assert.equal(res.zapis.kod, 503);
  assert.equal(res.zapis.tresc.code, "server.eventTeamsTableMissing");
  assert.match(res.zapis.tresc.error, /0014_event_teams\.sql/);
});

test("zapis do nieistniejacego turnieju to 404", async () => {
  const pool = fakePool({ brakEventu: true });
  const { put } = await trasy(pool);
  const res = fakeRes();

  await put(zadanie({ teamIds: [5] }), res);

  assert.equal(res.zapis.kod, 404);
  assert.equal(res.zapis.tresc.code, "server.eventNotFound");
  assert.deepEqual(pool.zapisane.usuniete, []);
});

/* === PANEL =============================================================== */

test("panel sklada ladunek ze SLOWNIKA, nie ze zbioru zaznaczen", () => {
  // Pulapka, ktorej nie widac na ekranie: Set trzyma kolejnosc KLIKANIA, wiec
  // zlozenie ladunku przez przejscie po zaznaczeniach zapisaloby rozstawienie
  // turnieju wedle tego, co admin kliknal pierwsze. Zadne zapytanie ani zrzut
  // ekranu tego nie pokaze - lista po prostu bylaby w innej kolejnosci.
  const panel = fs.readFileSync(PANEL, "utf8");

  assert.match(
    panel,
    /druzyny\.filter\(\(d\) => zaznaczone\.has\(d\.id\)\)/,
    "ladunek nie jest filtrowanym slownikiem",
  );

  for (const wzor of [/\[\s*\.\.\.zaznaczone\s*\]/, /Array\.from\(\s*zaznaczone/]) {
    assert.doesNotMatch(panel, wzor, "ladunek idzie po kolejnosci klikania");
  }
});
