// Historia gracza miedzy turniejami (server/lib/playerHistory.js).
//
// Testy pilnuja tego, co konczy sie liczbami wygladajacymi jak prawda:
// turnieju ogladanego wlasnie przez gracza doliczonego do "gral tez",
// dzielenia przez zero przy pustej stawce i zera procent udajacego
// pierwsze miejsce.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/playerHistory.js";

function wiersz(nadpisania = {}) {
  return {
    event_id: 88,
    name: "IEM Kraków 2026",
    slug: "iem-krakow-2026",
    is_archived: 1,
    total_points: 120,
    rank_position: 25,
    uczestnicy: 262,
    ...nadpisania,
  };
}

test("turniej ogladany wlasnie nie trafia do 'gral tez'", async () => {
  // Inaczej kazdy gracz widzialby na swoim profilu odnosnik do tego samego
  // profilu, na ktorym stoi.
  const { buildPlayerHistory } = await import(MODUL);

  const historia = buildPlayerHistory(
    [wiersz({ event_id: 88 }), wiersz({ event_id: 84, slug: "budapeszt" })],
    88,
  );

  assert.equal(historia.length, 1);
  assert.equal(historia[0].slug, "budapeszt");
});

test("identyfikator turnieju porownuje sie jako liczba", async () => {
  // Z bazy przychodzi liczba, z adresu tekst - "88" !== 88 przepusciloby
  // biezacy turniej na liste.
  const { buildPlayerHistory } = await import(MODUL);

  assert.equal(buildPlayerHistory([wiersz({ event_id: 88 })], "88").length, 0);
  assert.equal(buildPlayerHistory([wiersz({ event_id: "88" })], 88).length, 0);
});

test("gracz z jednego turnieju ma pusta historie", async () => {
  // Tak wyglada 946 z 1110 graczy w bazie, czyli 85% - to jest przypadek
  // normalny, nie brzegowy.
  const { buildPlayerHistory } = await import(MODUL);

  assert.deepEqual(buildPlayerHistory([wiersz({ event_id: 88 })], 88), []);
});

test("brak wierszy nie wywraca sie na undefined", async () => {
  const { buildPlayerHistory } = await import(MODUL);

  assert.deepEqual(buildPlayerHistory([], 88), []);
  assert.deepEqual(buildPlayerHistory(null, 88), []);
  assert.deepEqual(buildPlayerHistory(undefined, 88), []);
});

test("gorny procent stawki liczy sie z miejsca i liczby uczestnikow", async () => {
  const { buildPlayerHistory } = await import(MODUL);

  const [h] = buildPlayerHistory(
    [wiersz({ event_id: 84, rank_position: 26, uczestnicy: 260 })],
    88,
  );

  assert.equal(h.top_percent, 10);
  assert.equal(h.rank, 26);
  assert.equal(h.participants, 260);
});

test("pierwsze miejsce to gorny 1%, a nie 0%", async () => {
  // Zaokraglenie w dol dawaloby tu zero, co czyta sie jak brak danych.
  const { buildPlayerHistory } = await import(MODUL);

  const [h] = buildPlayerHistory(
    [wiersz({ event_id: 84, rank_position: 1, uczestnicy: 500 })],
    88,
  );

  assert.equal(h.top_percent, 1);
});

test("pusta stawka nie daje dzielenia przez zero", async () => {
  const { buildPlayerHistory } = await import(MODUL);

  const [h] = buildPlayerHistory(
    [wiersz({ event_id: 84, rank_position: 0, uczestnicy: 0 })],
    88,
  );

  assert.equal(h.rank, null, "brak miejsca to null, nie zero");
  assert.equal(h.top_percent, null);
  assert.equal(h.participants, 0);
});

test("punkty z NULL-a to zero", async () => {
  const { buildPlayerHistory } = await import(MODUL);

  const [h] = buildPlayerHistory(
    [wiersz({ event_id: 84, total_points: null })],
    88,
  );

  assert.equal(h.points, 0);
});

test("flaga archiwum przychodzi z bazy jako liczba, wychodzi jako prawda", async () => {
  const { buildPlayerHistory } = await import(MODUL);

  const [a] = buildPlayerHistory([wiersz({ event_id: 84, is_archived: 1 })], 88);
  const [b] = buildPlayerHistory([wiersz({ event_id: 85, is_archived: 0 })], 88);

  assert.equal(a.is_archived, true);
  assert.equal(b.is_archived, false);
});

test("kolejnosc z zapytania zostaje zachowana", async () => {
  // Zapytanie oddaje turnieje od najnowszego i tak maja stac na ekranie.
  const { buildPlayerHistory } = await import(MODUL);

  const historia = buildPlayerHistory(
    [
      wiersz({ event_id: 90, slug: "nowy" }),
      wiersz({ event_id: 84, slug: "stary" }),
    ],
    88,
  );

  assert.deepEqual(
    historia.map((h) => h.slug),
    ["nowy", "stary"],
  );
});
