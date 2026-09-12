// Numeracja meczów jest ciągła w evencie, nie liczona od nowa w każdej fazie.
//
// Trzy miejsca tworzące mecze liczyły numer same, każde z filtrem
// `AND phase = ?`, więc w jednym turnieju istniały trzy mecze "#1" - po jednym
// na Play-In, Double Elim i Playoffs.
//
// To nie była sama kosmetyka. Zapytania listujące sortują po match_no bez
// rozróżniania fazy, więc przy numeracji od nowa fazy przeplatały się:
// podgląd najbliższych meczów pokazywał #1 z jednej fazy, #1 z drugiej,
// #1 z trzeciej, a potem wszystkie #2.
//
// Test pilnuje jednej rzeczy: że zapytanie NIE filtruje po fazie. To jest
// dokładnie ten fragment, który był w trzech kopiach i we wszystkich trzech
// wyglądał tak samo źle.

const test = require("node:test");
const assert = require("node:assert/strict");

const { nextMatchNumber } = require("../utils/matchNumbers.js");

const GUILD_ID = "111";
const EVENT_ID = 42;

function fakePool(wartosc) {
  const zapytania = [];

  return {
    zapytania,
    async query(sql, params) {
      zapytania.push({ sql: String(sql), params });

      return [[{ nextNo: wartosc }]];
    },
  };
}

test("numer liczy się w obrębie eventu, bez filtra fazy", async () => {
  const pool = fakePool(25);

  const numer = await nextMatchNumber(pool, GUILD_ID, EVENT_ID);

  assert.equal(numer, 25);

  const { sql, params } = pool.zapytania[0];

  assert.match(sql, /MAX\(match_no\)/i);
  assert.match(sql, /guild_id\s*=\s*\?/i);
  assert.match(sql, /event_id\s*=\s*\?/i);

  // Sedno sprawy: gdy wróci warunek na fazę, numeracja znów zacznie się
  // od jedynki w każdej z nich.
  assert.doesNotMatch(
    sql,
    /phase/i,
    "zapytanie filtruje po fazie - numeracja znowu restartuje sie co faze",
  );

  assert.deepEqual(
    params,
    [GUILD_ID, EVENT_ID],
    "do zapytania idzie tylko gildia i event",
  );
});

test("pusty event zaczyna od jedynki", async () => {
  // COALESCE(MAX(...), 0) + 1 - pierwszy mecz w evencie dostaje 1, a nie null.
  const numer = await nextMatchNumber(fakePool(1), GUILD_ID, EVENT_ID);

  assert.equal(numer, 1);
});

test("wynik jest liczbą, także gdy sterownik odda tekst", async () => {
  // MySQL potrafi zwrocic wartosci liczbowe jako string zaleznie od typu
  // kolumny i konfiguracji sterownika; numer idzie potem do porownan i do
  // kolejnego INSERT-a, wiec musi byc liczba.
  const numer = await nextMatchNumber(fakePool("7"), GUILD_ID, EVENT_ID);

  assert.equal(numer, 7);
  assert.equal(typeof numer, "number");
});

test("brak wiersza nie wywraca tworzenia meczu", async () => {
  const pool = {
    async query() {
      return [[]];
    },
  };

  // Wolajacy wstawia ten numer do bazy - undefined zamienilby sie w NULL
  // i mecz trafilby na liste bez numeru.
  assert.equal(await nextMatchNumber(pool, GUILD_ID, EVENT_ID), 1);
});
