// Roster TURNIEJU z zapasem w rosterze serwera (utils/loadEventTeams.js).
//
// PO CO TA WARSTWA. Kolumna teams.active pelnila dotad role "bierze udzial
// w biezacym turnieju" - jedna flaga na caly serwer. Stan z produkcji: jeden
// serwer ma 16 aktywnych i 13 wylaczonych druzyn, a wszystkie 300 zapisanych
// typow playoffs zawiera co najmniej jedna z wylaczonych. Przy jednej fladze
// nie da sie przygotowac nastepnego turnieju bez zmiany biezacego.
//
// CZEGO PILNUJA TE TESTY - trzech rzeczy, kazda moze cicho zepsuc turniej:
//
//   1. ZAPAS. Turniej bez wlasnego rostera MUSI dostac dokladnie to, co
//      dostawal przed ta zmiana. Inaczej pierwsze wdrozenie przestawiloby
//      listy druzyn we wszystkich istniejacych turniejach.
//   2. BRAK TABELI nie jest awaria. Kod moze pojsc na produkcje przed
//      migracja 0014 i odwrotnie.
//   3. KOLEJNOSC zostaje rozna tam, gdzie dzis jest rozna. Playoffs sortuje
//      po rozstawieniu, Double Elim alfabetycznie - przejscie na roster
//      turnieju ma nie zmienic ani jednej listy.
//
// Atrapa puli - nic nie laczy sie z baza.

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadEventTeamRows,
  loadEventTeamNames,
} = require("../utils/loadEventTeams");

const {
  loadActiveTeams,
  loadActiveTeamsBySortOrder,
  loadActiveTeamRows,
} = require("../utils/loadActiveTeams");

const GILDIA = "1221762685595553834";
const EVENT_ID = 88;

// Roster serwera: szesnascie aktywnych w produkcji, tu trzy wystarcza.
const ROSTER = [
  { id: 1, name: "Astralis" },
  { id: 2, name: "FaZe" },
  { id: 3, name: "NAVI" },
];

// Roster turnieju: dwie druzyny, w kolejnosci rozstawienia ODWROTNEJ do
// alfabetycznej - zeby bylo widac, ktora kolejnosc zadzialala.
const TURNIEJ = [
  { id: 3, name: "NAVI" },
  { id: 2, name: "FaZe" },
];

function fakePool({ turniej = null, brakTabeli = false, blad = null } = {}) {
  const zapytania = [];

  return {
    zapytania,

    get pytanoOEventTeams() {
      return zapytania.some((q) => /FROM event_teams/.test(q.sql));
    },

    get pytanoORoster() {
      return zapytania.some((q) => /FROM teams\b/.test(q.sql));
    },

    query(sql, args) {
      const tekst = String(sql);

      zapytania.push({ sql: tekst, args });

      if (/FROM event_teams/.test(tekst)) {
        if (brakTabeli) {
          const err = new Error("Table 'pickemdb.event_teams' doesn't exist");

          err.code = "ER_NO_SUCH_TABLE";

          return Promise.reject(err);
        }

        if (blad) return Promise.reject(blad);

        // Atrapa oddaje liste w kolejnosci, w ktorej ja dostala - to baza
        // sortuje, a tu sprawdzamy, CZY zapytanie o to poprosilo.
        return Promise.resolve([turniej || [], []]);
      }

      if (/FROM teams\b/.test(tekst)) {
        return Promise.resolve([ROSTER, []]);
      }

      return Promise.resolve([[], []]);
    },
  };
}

/* ---------------- zapas: turniej bez wlasnego rostera ---------------- */

test("turniej bez wlasnego rostera dostaje roster serwera", async () => {
  const pool = fakePool({ turniej: [] });

  const nazwy = await loadEventTeamNames(pool, {
    eventId: EVENT_ID,
    guildId: GILDIA,
  });

  assert.deepEqual(nazwy, ["Astralis", "FaZe", "NAVI"]);

  assert.ok(pool.pytanoOEventTeams, "nie zapytano o roster turnieju");
  assert.ok(pool.pytanoORoster, "nie zszedl na roster serwera");
});

test("zapas daje DOKLADNIE to, co loadActiveTeams", async () => {
  // Najwazniejsze zdanie w tym pliku: pierwsze wdrozenie nie moze przestawic
  // listy druzyn w zadnym istniejacym turnieju.
  const przez = await loadEventTeamNames(fakePool({ turniej: [] }), {
    eventId: EVENT_ID,
    guildId: GILDIA,
  });

  const wprost = await loadActiveTeams(fakePool(), GILDIA);

  assert.deepEqual(przez, wprost);
});

test("brak turnieju w ogole idzie prosto na roster serwera", async () => {
  const pool = fakePool({ turniej: TURNIEJ });

  const nazwy = await loadEventTeamNames(pool, {
    eventId: null,
    guildId: GILDIA,
  });

  assert.deepEqual(nazwy, ["Astralis", "FaZe", "NAVI"]);
  assert.equal(pool.pytanoOEventTeams, false, "pytanie bez eventId jest zbedne");
});

/* ---------------- wlasny roster turnieju ---------------- */

test("turniej z wlasnym rosterem NIE siega po roster serwera", async () => {
  const pool = fakePool({ turniej: TURNIEJ });

  const nazwy = await loadEventTeamNames(pool, {
    eventId: EVENT_ID,
    guildId: GILDIA,
  });

  assert.deepEqual(nazwy, ["NAVI", "FaZe"]);
  assert.equal(pool.pytanoORoster, false, "roster serwera nie powinien byc czytany");
});

test("wiersze niosa id, bo front uzywa go jako klucza", async () => {
  const rows = await loadEventTeamRows(fakePool({ turniej: TURNIEJ }), {
    eventId: EVENT_ID,
    guildId: GILDIA,
  });

  assert.deepEqual(rows, TURNIEJ);
});

test("zapytanie o roster turnieju jest zawezone do SERWERA, nie tylko turnieju", async () => {
  // Zle zasiany wiersz w event_teams nie moze wciagnac na liste druzyny
  // z innego serwera Discorda.
  const pool = fakePool({ turniej: TURNIEJ });

  await loadEventTeamNames(pool, { eventId: EVENT_ID, guildId: GILDIA });

  const zapytanie = pool.zapytania.find((q) => /FROM event_teams/.test(q.sql));

  assert.match(zapytanie.sql, /t\.guild_id = \?/);
  assert.deepEqual(zapytanie.args, [EVENT_ID, GILDIA]);
});

/* ---------------- kolejnosc ---------------- */

test("kolejnosc alfabetyczna pyta o nazwe, rozstawienie o sort_order turnieju", async () => {
  const alfabet = fakePool({ turniej: TURNIEJ });

  await loadEventTeamNames(alfabet, {
    eventId: EVENT_ID,
    guildId: GILDIA,
    order: "name",
  });

  const pierwsze = alfabet.zapytania.find((q) => /FROM event_teams/.test(q.sql));

  assert.match(pierwsze.sql, /ORDER BY t\.name ASC/);

  const rozstawienie = fakePool({ turniej: TURNIEJ });

  await loadEventTeamNames(rozstawienie, {
    eventId: EVENT_ID,
    guildId: GILDIA,
    order: "sort_order",
  });

  const drugie = rozstawienie.zapytania.find((q) =>
    /FROM event_teams/.test(q.sql),
  );

  // Rozstawienie z TEGO turnieju, nie z konfiguracji serwera.
  assert.match(drugie.sql, /ORDER BY et\.sort_order ASC, t\.name ASC/);
});

test("zapas trzyma kolejnosc, o ktora poproszono", async () => {
  const pool = fakePool({ turniej: [] });

  await loadEventTeamNames(pool, {
    eventId: EVENT_ID,
    guildId: GILDIA,
    order: "sort_order",
  });

  const roster = pool.zapytania.find((q) => /FROM teams\b/.test(q.sql));

  assert.match(roster.sql, /ORDER BY sort_order ASC, name ASC/);
});

test("nieznana kolejnosc to blad, nie cicha zmiana listy", async () => {
  await assert.rejects(
    () =>
      loadEventTeamNames(fakePool(), {
        eventId: EVENT_ID,
        guildId: GILDIA,
        order: "losowo",
      }),
    /nieznana kolejnosc/,
  );
});

test("brak guildId to blad - inaczej zapytanie objeloby caly serwis", async () => {
  await assert.rejects(
    () => loadEventTeamNames(fakePool(), { eventId: EVENT_ID }),
    /guildId/,
  );
});

/* ---------------- tabeli jeszcze nie ma ---------------- */

test("BRAK TABELI event_teams nie jest awaria - schodzi na roster serwera", async () => {
  // Kod moze pojsc na produkcje przed migracja 0014 i odwrotnie.
  const pool = fakePool({ brakTabeli: true });

  const nazwy = await loadEventTeamNames(pool, {
    eventId: EVENT_ID,
    guildId: GILDIA,
  });

  assert.deepEqual(nazwy, ["Astralis", "FaZe", "NAVI"]);
});

test("KAZDY INNY blad bazy idzie w gore, a nie na zapas", async () => {
  // Awaria bazy potraktowana jako "turniej nie ma rostera" dawalaby po cichu
  // inna liste druzyn - czyli dokladnie to, czego ta warstwa ma nie robic.
  const blad = new Error("Lost connection to MySQL server");

  blad.code = "PROTOCOL_CONNECTION_LOST";

  await assert.rejects(
    () =>
      loadEventTeamNames(fakePool({ blad }), {
        eventId: EVENT_ID,
        guildId: GILDIA,
      }),
    /Lost connection/,
  );
});

/* ---------------- roster serwera zostal nietkniety ---------------- */

test("oba dotychczasowe warianty rostera dzialaja jak przedtem", async () => {
  const alfabet = fakePool();

  assert.deepEqual(await loadActiveTeams(alfabet, GILDIA), [
    "Astralis",
    "FaZe",
    "NAVI",
  ]);

  assert.match(alfabet.zapytania[0].sql, /ORDER BY name ASC/);

  const rozstawienie = fakePool();

  await loadActiveTeamsBySortOrder(rozstawienie, GILDIA);

  assert.match(
    rozstawienie.zapytania[0].sql,
    /ORDER BY sort_order ASC, name ASC/,
  );
});

test("roster serwera umie teraz oddac takze id", async () => {
  // Potrzebne formularzom faz na stronie - bez tego zapytanie o roster
  // stalo w dwoch kopiach (tu i w server/lib/phaseFormTeams.js).
  const rows = await loadActiveTeamRows(fakePool(), GILDIA);

  assert.deepEqual(rows, ROSTER);
});

test("puste nazwy nie wchodza na zadna z list", async () => {
  const pool = {
    query: () =>
      Promise.resolve([[{ id: 1, name: "FaZe" }, { id: 2, name: "" }, null], []]),
  };

  assert.deepEqual(await loadActiveTeams(pool, GILDIA), ["FaZe"]);
});
