// Uzupelnianie user_profiles o graczy, ktorzy nigdy nie weszli na strone.
//
// Nick i awatar trafiaja do tej tabeli przy logowaniu na stronie albo przy
// interakcji z botem. Turnieje, ktore juz sie skonczyly, nie dostana nowych
// interakcji - na produkcji 1108 z 1110 graczy nie ma tam wiersza, a awatara
// nie zapisywal nigdy nikt, wiec jedynym zrodlem jest Discord.
//
// Ten kod robi ~1100 zapytan do cudzego serwisu, wiec testy sprawdzaja przede
// wszystkim to, co przy takiej skali boli: ze jedno skasowane konto nie
// zatrzymuje calosci, ze odstepy miedzy zapytaniami sa zachowane i ze
// powtorne uruchomienie bierze tylko tych, ktorych zabraklo.

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  backfillProfiles,
  DOMYSLNY_LIMIT,
  ODSWIEZ_PO_DNIACH,
} = require("../services/backfillProfiles.js");

const GUILD = "111";

function fakePool(identyfikatory) {
  const zapisane = [];
  const zapytania = [];

  return {
    zapisane,
    zapytania,
    async query(sql, params) {
      const tekst = String(sql);
      zapytania.push({ sql: tekst, params });

      if (tekst.includes("FROM leaderboard")) {
        return [identyfikatory.map((id) => ({ user_id: id }))];
      }

      if (tekst.includes("INSERT INTO user_profiles")) {
        zapisane.push(params);
        return [{ affectedRows: 1 }];
      }

      throw new Error(`nieoczekiwane zapytanie: ${tekst}`);
    },
  };
}

function uzytkownik(id, nadpisz = {}) {
  return {
    id,
    username: `user${id}`,
    globalName: `Nick ${id}`,
    avatar: `hash${id}`,
    ...nadpisz,
  };
}

function bladDiscorda(code) {
  const err = new Error("Discord");
  err.code = code;
  return err;
}

// Bez prawdziwego czekania - odstepy sprawdzamy licznikiem, nie zegarem.
function bezCzekania() {
  const wywolania = [];
  return {
    wywolania,
    sleep: async (ms) => {
      wywolania.push(ms);
    },
  };
}

test("zapisuje nick i awatar kazdego znalezionego gracza", async () => {
  const pool = fakePool(["1", "2"]);
  const { sleep } = bezCzekania();

  const wynik = await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async (id) => uzytkownik(id),
    sleep,
  });

  assert.deepEqual(wynik, {
    sprawdzonych: 2,
    zapisanych: 2,
    nieznanych: 0,
    bledow: 0,
  });

  assert.deepEqual(pool.zapisane, [
    ["1", "user1", "Nick 1", "hash1"],
    ["2", "user2", "Nick 2", "hash2"],
  ]);
});

test("skasowane konto nie zatrzymuje reszty", async () => {
  // Przy tysiacu graczy jedno takie konto jest pewne. Przerwanie calosci
  // oznaczaloby, ze im dluzsza lista, tym mniejsza szansa na jej skonczenie.
  const pool = fakePool(["1", "2", "3"]);
  const { sleep } = bezCzekania();

  const wynik = await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async (id) => {
      if (id === "2") throw bladDiscorda(10013);
      return uzytkownik(id);
    },
    sleep,
  });

  assert.equal(wynik.zapisanych, 2);
  assert.equal(wynik.nieznanych, 1);
  assert.equal(wynik.bledow, 0);
  assert.deepEqual(
    pool.zapisane.map((p) => p[0]),
    ["1", "3"],
    "gracz po skasowanym koncie ma zostac przetworzony",
  );
});

test("awaria sieci liczy sie osobno od skasowanego konta", async () => {
  // Rozroznienie ma znaczenie dla decyzji: skasowane konto zostanie takim na
  // zawsze, a blad sieci znaczy "uruchom ponownie".
  const pool = fakePool(["1", "2"]);
  const { sleep } = bezCzekania();

  const wynik = await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async (id) => {
      if (id === "1") throw new Error("ETIMEDOUT");
      return uzytkownik(id);
    },
    sleep,
  });

  assert.equal(wynik.bledow, 1);
  assert.equal(wynik.nieznanych, 0);
  assert.equal(wynik.zapisanych, 1);
});

test("pusta odpowiedz to nieznane konto, nie zapis pustego profilu", async () => {
  const pool = fakePool(["1"]);
  const { sleep } = bezCzekania();

  const wynik = await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async () => null,
    sleep,
  });

  assert.equal(wynik.nieznanych, 1);
  assert.deepEqual(pool.zapisane, [], "nie wolno zapisac pustego profilu");
});

test("odstep miedzy zapytaniami, ale nie przed pierwszym ani po ostatnim", async () => {
  const pool = fakePool(["1", "2", "3"]);
  const zegar = bezCzekania();

  await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async (id) => uzytkownik(id),
    delayMs: 200,
    sleep: zegar.sleep,
  });

  assert.deepEqual(
    zegar.wywolania,
    [200, 200],
    "trzy zapytania to dwie przerwy - czekanie po ostatnim tylko przedluza odpowiedz",
  );
});

test("konto bez nazwy globalnej dostaje username", async () => {
  const pool = fakePool(["1"]);
  const { sleep } = bezCzekania();

  await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async (id) =>
      uzytkownik(id, { globalName: null, displayName: null }),
    sleep,
  });

  assert.deepEqual(pool.zapisane[0], ["1", "user1", "user1", "hash1"]);
});

test("brak awatara zapisuje sie jako NULL, a nie undefined", async () => {
  // undefined w parametrach mysql2 leci jako blad zapytania, nie jako NULL.
  const pool = fakePool(["1"]);
  const { sleep } = bezCzekania();

  await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async (id) => uzytkownik(id, { avatar: undefined }),
    sleep,
  });

  assert.equal(pool.zapisane[0][3], null);
});

test("zapytanie bierze tylko brakujacych, z tej gildii i z limitem", async () => {
  // Na tym stoi wznawianie: powtorne uruchomienie samo pomija zapisanych,
  // wiec nie trzeba nigdzie trzymac, gdzie sie skonczylo.
  const pool = fakePool([]);
  const { sleep } = bezCzekania();

  await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async () => null,
    limit: 250,
    sleep,
  });

  const zapytanie = pool.zapytania[0];

  assert.match(zapytanie.sql, /FROM leaderboard/);
  assert.match(zapytanie.sql, /LEFT JOIN user_profiles/);
  assert.match(zapytanie.sql, /up\.user_id IS NULL/);
  assert.match(zapytanie.sql, /lb\.guild_id = \?/);
  assert.deepEqual(zapytanie.params, [GUILD, ODSWIEZ_PO_DNIACH, 250]);
});

test("konto bez wlasnego awatara nie wraca przy kazdym uruchomieniu", async () => {
  // 61 graczy na produkcji po prostu nie ma wlasnego obrazka - Discord zwraca
  // dla nich null i zadne kolejne uruchomienie tego nie zmieni. Bez granicy
  // czasowej warunek "brak awatara" wybieral je w kolko, wiec komenda nigdy
  // nie mowila "wszyscy gotowi", tylko raportowala zero zapisanych.
  const pool = fakePool([]);
  const { sleep } = bezCzekania();

  await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async () => null,
    sleep,
  });

  const { sql, params } = pool.zapytania[0];

  // Bialе znaki znormalizowane - wzorzec ma pilnowac warunku, a nie tego,
  // jak SQL jest polamany na linie.
  const jednymCiagiem = sql.replace(/\s+/g, " ");

  assert.match(
    jednymCiagiem,
    /up\.avatar IS NULL AND up\.updated_at < DATE_SUB/,
    "brak awatara ma byc powodem do zapytania tylko dla starego profilu",
  );
  assert.equal(
    params[1],
    ODSWIEZ_PO_DNIACH,
    "granica wieku profilu idzie parametrem, a nie jest wklejona w SQL",
  );
});

test("granice odswiezania da sie ustawic", async () => {
  const pool = fakePool([]);
  const { sleep } = bezCzekania();

  await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async () => null,
    odswiezPoDniach: 7,
    sleep,
  });

  assert.equal(pool.zapytania[0].params[1], 7);
});

test("brak wiersza w profilach jest powodem zawsze, bez wzgledu na daty", async () => {
  // Warunek czasowy dotyczy WYLACZNIE profili, ktore juz istnieja. Gracz bez
  // wiersza musi trafic do zapytania przy pierwszym uruchomieniu.
  const pool = fakePool([]);
  const { sleep } = bezCzekania();

  await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async () => null,
    sleep,
  });

  const { sql } = pool.zapytania[0];
  const warunek = sql.slice(sql.indexOf("WHERE")).replace(/\s+/g, " ");

  assert.match(
    warunek,
    /up\.user_id IS NULL OR/,
    "brak profilu ma byc osobnym powodem, polaczonym przez OR",
  );
});

test("postep raportuje po kazdym graczu", async () => {
  const pool = fakePool(["1", "2"]);
  const { sleep } = bezCzekania();
  const postep = [];

  await backfillProfiles({
    pool,
    guildId: GUILD,
    fetchUser: async (id) => uzytkownik(id),
    onProgress: (s) => postep.push(s.przetworzonych),
    sleep,
  });

  assert.deepEqual(postep, [1, 2]);
});

test("domyslny limit jest ustawiony i rozsadny", async () => {
  // Token odpowiedzi na interakcje Discorda zyje 15 minut; przy 200 ms na
  // gracza limit musi sie w tym miescic z zapasem.
  assert.ok(DOMYSLNY_LIMIT > 0);
  assert.ok(
    (DOMYSLNY_LIMIT * 200) / 1000 < 10 * 60,
    "przebieg musi sie zmiescic w oknie zycia tokenu",
  );
});
