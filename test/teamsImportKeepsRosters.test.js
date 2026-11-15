// Czy import slownika druzyn nadal kasuje caly slownik - i co mowi o tym,
// co zabral.
//
// PO CO TEST NA SAMA KOLEJNOSC ZAPYTAN. Plan dopasowania ma wlasne testy
// (test/teamsReplacePlan.test.js), ale plan sam z siebie niczego nie chroni.
// Chronia go trzy wlasnosci ZAPYTAN, a kazda z nich da sie zepsuc bez
// zepsucia planu:
//
//   1. NIE MA kasowania calego slownika jednym `DELETE FROM teams WHERE
//      guild_id = ?`. To bylo zrodlo bledu: `event_teams` ma
//      `ON DELETE CASCADE`, wiec takie kasowanie zabieralo rostery
//      WSZYSTKICH turniejow serwera.
//
//   2. Rostery liczy sie PRZED kasowaniem. Po nim nie ma czego liczyc, wiec
//      przestawienie tych dwoch zapytan daje zawsze zero i komunikat
//      milczy - a import nadal zabiera rostery.
//
//   3. Calosc idzie w JEDNEJ transakcji. Dotad `DELETE` i `INSERT` byly
//      dwoma zapytaniami w autocommit, wiec blad przy wstawianiu zostawial
//      serwer z PUSTYM slownikiem. ER_DUP_ENTRY jest w modalu bota obsluzony
//      wprost, czyli sie zdarzal.
//
// Atrapa puli podstawia sie przez db.getPoolForGuild, bo utils/guildContext.js
// siega po nia przez wlasciwosc modulu przy kazdym wywolaniu.

const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const teamsStore = require("../utils/teamsStore");

const GUILD = "111222333444555666";

const SLOWNIK = [
  { id: 101, name: "Vitality" },
  { id: 102, name: "BETBOOM" },
  { id: 103, name: "MOUZ" },
];

function atrapa({
  slownik = SLOWNIK,
  rostery = [],
  brakTabeli = false,
  bladInsertu = false,
} = {}) {
  const log = [];

  async function odpowiedz(sql, params) {
    const tekst = String(sql).replace(/\s+/g, " ").trim();

    log.push({ sql: tekst, params });

    if (tekst.startsWith("SELECT id, name FROM teams")) {
      return [slownik.map((w) => ({ ...w })), []];
    }

    if (tekst.includes("FROM event_teams")) {
      if (brakTabeli) {
        const err = new Error("Table 'event_teams' doesn't exist");
        err.code = "ER_NO_SUCH_TABLE";

        throw err;
      }

      return [rostery, []];
    }

    if (tekst.startsWith("INSERT INTO teams")) {
      if (bladInsertu) {
        const err = new Error("Duplicate entry");
        err.code = "ER_DUP_ENTRY";

        throw err;
      }

      return [{ affectedRows: 1 }];
    }

    return [{ affectedRows: 1 }];
  }

  const conn = {
    async beginTransaction() {
      log.push({ sql: "BEGIN" });
    },
    async commit() {
      log.push({ sql: "COMMIT" });
    },
    async rollback() {
      log.push({ sql: "ROLLBACK" });
    },
    release() {},
    query: odpowiedz,
  };

  const pool = {
    async getConnection() {
      return conn;
    },
    query: odpowiedz,
  };

  return { pool, log };
}

async function zImportem(opcje, nazwy) {
  const { pool, log } = atrapa(opcje);
  const oryginal = db.getPoolForGuild;

  db.getPoolForGuild = () => pool;

  try {
    const wynik = await teamsStore.importTeamsFromJsonText(
      GUILD,
      JSON.stringify(nazwy),
    );

    return { wynik, log };
  } finally {
    db.getPoolForGuild = oryginal;
  }
}

const kasowania = (log) =>
  log.filter((z) => z.sql.startsWith("DELETE FROM teams"));

test("NIE MA kasowania calego slownika - nigdy, przy zadnej liscie", async () => {
  const listy = [
    ["Vitality", "BETBOOM", "MOUZ"],
    ["Vitality"],
    ["Astralis", "G2"],
    [],
  ];

  for (const lista of listy) {
    const { log } = await zImportem({}, lista);

    for (const z of kasowania(log)) {
      assert.match(
        z.sql,
        /DELETE FROM teams WHERE guild_id = \? AND id IN \(\?\)/,
        `[${lista.join(", ")}] kasowanie bez ograniczenia do id: ${z.sql}`,
      );
    }
  }
});

test("ta sama lista nazw nie kasuje niczego i zostawia id", async () => {
  const { wynik, log } = await zImportem({}, ["Vitality", "BETBOOM", "MOUZ"]);

  assert.deepEqual(kasowania(log), []);

  const aktualizacje = log.filter((z) => z.sql.startsWith("UPDATE teams"));

  assert.equal(aktualizacje.length, 3);

  assert.deepEqual(
    aktualizacje.map((z) => z.params[3]),
    [101, 102, 103],
    "aktualizowane maja byc TE SAME wiersze",
  );

  assert.equal(
    log.filter((z) => z.sql.startsWith("INSERT INTO teams")).length,
    0,
  );

  assert.deepEqual(wynik, {
    imported: 3,
    kept: 3,
    added: 0,
    removed: [],
    rosterRowsRemoved: 0,
    rosterEventsAffected: [],
  });
});

test("rostery liczy sie PRZED kasowaniem", async () => {
  const { log } = await zImportem(
    { rostery: [{ turniej: "ESL Pro League Season 24", ile: 16 }] },
    ["Vitality"],
  );

  const liczenie = log.findIndex((z) => z.sql.includes("FROM event_teams"));
  const kasowanie = log.findIndex((z) => z.sql.startsWith("DELETE FROM teams"));

  assert.ok(liczenie !== -1, "rostery nie sa w ogole liczone");
  assert.ok(kasowanie !== -1, "nic nie jest kasowane, a powinno");
  assert.ok(
    liczenie < kasowanie,
    "po kasowaniu nie ma czego liczyc - komunikat zawsze powie zero",
  );
});

test("import mowi, ktore turnieje straca roster", async () => {
  const { wynik } = await zImportem(
    {
      rostery: [
        { turniej: "ESL Pro League Season 24", ile: 16 },
        { turniej: "IEM Cologne Major 2026", ile: 18 },
      ],
    },
    ["Vitality", "BETBOOM"],
  );

  assert.deepEqual(wynik.removed, ["MOUZ"]);
  assert.equal(wynik.rosterRowsRemoved, 34);
  assert.deepEqual(wynik.rosterEventsAffected, [
    "ESL Pro League Season 24",
    "IEM Cologne Major 2026",
  ]);
});

test("druzyna, ktora zostala na liscie, nie liczy sie jako utrata rostera", async () => {
  // Wiersze rosterow w atrapie nalezaja do druzyn USUWANYCH - gdy nic nie
  // wypada, zapytanie o rostery w ogole nie idzie.
  const { wynik, log } = await zImportem(
    { rostery: [{ turniej: "ESL Pro League Season 24", ile: 16 }] },
    ["Vitality", "BETBOOM", "MOUZ"],
  );

  assert.equal(wynik.rosterRowsRemoved, 0);
  assert.deepEqual(wynik.rosterEventsAffected, []);
  assert.equal(
    log.filter((z) => z.sql.includes("FROM event_teams")).length,
    0,
    "bez usuwanych druzyn nie ma o co pytac",
  );
});

test("brak tabeli event_teams nie jest awaria importu", async () => {
  const { wynik } = await zImportem({ brakTabeli: true }, ["Vitality"]);

  assert.equal(wynik.imported, 1);
  assert.equal(wynik.rosterRowsRemoved, 0);
});

test("blad przy wstawianiu COFA calosc - slownik nie zostaje pusty", async () => {
  const { pool, log } = atrapa({ bladInsertu: true });
  const oryginal = db.getPoolForGuild;

  db.getPoolForGuild = () => pool;

  try {
    await assert.rejects(
      () =>
        teamsStore.importTeamsFromJsonText(
          GUILD,
          JSON.stringify(["Astralis", "G2"]),
        ),
      (err) => err.code === "ER_DUP_ENTRY",
    );
  } finally {
    db.getPoolForGuild = oryginal;
  }

  assert.ok(
    log.some((z) => z.sql === "ROLLBACK"),
    "brak wycofania - skasowane druzyny zostalyby skasowane",
  );

  assert.ok(
    !log.some((z) => z.sql === "COMMIT"),
    "nie wolno zatwierdzic przebiegu, ktory sie wywrocil",
  );
});

test("caly przebieg idzie w jednej transakcji", async () => {
  const { log } = await zImportem({}, ["Vitality", "Astralis"]);

  assert.equal(log[0].sql, "BEGIN", "pierwsze ma byc otwarcie transakcji");
  assert.equal(
    log[log.length - 1].sql,
    "COMMIT",
    "ostatnie ma byc zatwierdzenie",
  );
});

test("zmiany nazw ida PRZED wstawieniami", async () => {
  // Nazwa zwolniona przez zmiane nazwy innego wiersza musi byc wolna, gdy
  // dochodzi do wstawienia. Tu wiersz 103 "Natus Vincere" zmienia sie na
  // "NAVI" (to samo teamKey), a "Natus Vincere" wchodzi jako NOWY wiersz.
  // Przy odwrotnej kolejnosci MySQL odrzuci wstawienie kluczem
  // uniq_guild_name - i to jest jedyne, co tego pilnuje.
  const { log } = await zImportem(
    { slownik: [{ id: 103, name: "Natus Vincere" }] },
    ["NAVI", "Natus Vincere"],
  );

  const ostatniUpdate = log.reduce(
    (akc, z, i) => (z.sql.startsWith("UPDATE teams") ? i : akc),
    -1,
  );

  const wstawienie = log.findIndex((z) => z.sql.startsWith("INSERT INTO teams"));

  assert.ok(ostatniUpdate !== -1, "nie ma zadnej zmiany nazwy, a powinna byc");
  assert.ok(wstawienie !== -1, "nie ma wstawienia, a powinno byc");
  assert.ok(
    ostatniUpdate < wstawienie,
    "wstawienie idzie przed zmiana nazwy - nazwa jest jeszcze zajeta",
  );
});

test("kasowanie idzie PRZED zmianami nazw", async () => {
  // Druga strona tej samej zaleznosci: nazwa zwolniona przez USUNIECIE
  // wiersza moze byc celem zmiany nazwy innego wiersza.
  const { log } = await zImportem({}, ["Vitality", "BETBOOM"]);

  const kasowanie = log.findIndex((z) => z.sql.startsWith("DELETE FROM teams"));

  const pierwszyUpdate = log.findIndex((z) => z.sql.startsWith("UPDATE teams"));

  assert.ok(kasowanie !== -1 && pierwszyUpdate !== -1);
  assert.ok(kasowanie < pierwszyUpdate, "kasowanie musi zwolnic nazwy pierwsze");
});

test("slownik czyta sie z FOR UPDATE", async () => {
  // Bez blokady wiersze moga sie zmienic miedzy odczytem a zapisem, a plan
  // jest liczony wlasnie z tego odczytu.
  const { log } = await zImportem({}, ["Vitality"]);

  const odczyt = log.find((z) => z.sql.startsWith("SELECT id, name FROM teams"));

  assert.match(odczyt.sql, /FOR UPDATE$/);
});
