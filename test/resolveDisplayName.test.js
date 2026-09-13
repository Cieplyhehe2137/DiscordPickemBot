// Nazwa gracza pokazywana w kafelkach statystyk eventu.
//
// Zapytania biora nazwe z user_profiles, a ta tabela ma wiersz WYLACZNIE dla
// osob, ktore logowaly sie na stronie. Kto typuje z Discorda, tam go nie ma:
// na IEM Cologne 2026 dotyczylo to 521 z 523 graczy. Kafelki "Najlepszy
// wynik", "Najwiecej exactow" i "Najlepsza skutecznosc" pokazywaly wiec
// surowy identyfikator Discorda.
//
// Ten sam gracz mial przez to dwie nazwy na JEDNEJ stronie: ranking pokazywal
// "pieka", bo szuka nazwy w tabelach typow, a kafelek obok -
// "1216263156742094870".
//
// Testy pilnuja kolejnosci zapasow, bo to ona decyduje o tym, co zobaczy
// odwiedzajacy, i kazdy jej stopien ma inne zrodlo danych.

const test = require("node:test");
const assert = require("node:assert/strict");

const PARTICIPANTS = "../server/lib/participants.js";

const EVENT_ID = 37;
const USER_ID = "1216263156742094870";

// Atrapa puli: findNameFromPicks robi jedno zapytanie UNION po tabelach faz.
// Oddajemy to, co ma z niego wyjsc, i liczymy wywolania - zeby sprawdzic, ze
// przy gotowej nazwie z profilu baza nie jest pytana w ogole.
function fakePool(nazwaZTypow) {
  const zapytania = [];

  return {
    zapytania,
    async query(sql, params) {
      zapytania.push({ sql: String(sql), params });

      return [nazwaZTypow ? [{ nazwa: nazwaZTypow }] : []];
    },
  };
}

async function rozwiaz(wiersz, nazwaZTypow) {
  const { createParticipantQueries } = await import(PARTICIPANTS);
  const pool = fakePool(nazwaZTypow);
  const { resolveDisplayName } = createParticipantQueries(pool);

  return { nazwa: await resolveDisplayName(EVENT_ID, wiersz), pool };
}

test("nazwa z profilu wygrywa i nie pyta bazy", async () => {
  // Profil aktualizuje sie przy kazdym logowaniu, wiec jest najswiezszy.
  const { nazwa, pool } = await rozwiaz(
    { user_id: USER_ID, displayname: "pieka" },
    "stara-nazwa-z-typow",
  );

  assert.equal(nazwa, "pieka");
  assert.equal(
    pool.zapytania.length,
    0,
    "przy gotowej nazwie nie ma po co pytac o tabele typow",
  );
});

test("bez profilu bierze nazwe z tabel typow", async () => {
  // To jest ten przypadek, ktory psul kafelki: 521 z 523 graczy Cologne
  // nie ma wpisu w user_profiles.
  const { nazwa, pool } = await rozwiaz(
    { user_id: USER_ID, displayname: null },
    "pieka",
  );

  assert.equal(nazwa, "pieka");
  assert.equal(pool.zapytania.length, 1, "dokladnie jedno zapytanie zapasowe");
  assert.deepEqual(
    pool.zapytania[0].params.filter((p) => p === String(USER_ID)).length > 0,
    true,
    "zapytanie musi dotyczyc tego gracza",
  );
});

test("gdy nie ma nigdzie nazwy, zostaje identyfikator", async () => {
  // Lepszy surowy numer niz puste miejsce - mowi, ze tego gracza nie ma juz
  // w zadnych danych tego turnieju.
  const { nazwa } = await rozwiaz(
    { user_id: USER_ID, displayname: null },
    null,
  );

  assert.equal(nazwa, USER_ID);
});

test("identyfikator liczbowy wychodzi jako tekst", async () => {
  // mysql2 potrafi oddac user_id jako liczbe; do JSON-a ma isc tekst, bo
  // identyfikatory Discorda przekraczaja bezpieczny zakres liczb w JS.
  const { nazwa } = await rozwiaz({ user_id: 12345, displayname: null }, null);

  assert.equal(nazwa, "12345");
  assert.equal(typeof nazwa, "string");
});

test("pusty napis w profilu to brak nazwy, nie nazwa", async () => {
  // COALESCE zwroci pusty ciag, jesli taki siedzi w kolumnie - a pusty
  // kafelek wyglada jak awaria.
  const { nazwa } = await rozwiaz(
    { user_id: USER_ID, displayname: "" },
    "pieka",
  );

  assert.equal(nazwa, "pieka");
});

test("brak wiersza to null, nie wywrotka", async () => {
  // Kafelek jest opcjonalny - przy turnieju bez typow zapytanie nie zwraca
  // nic i widok ma po prostu go nie pokazac.
  const { nazwa } = await rozwiaz(null, "pieka");

  assert.equal(nazwa, null);
});
