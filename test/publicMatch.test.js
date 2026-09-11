// Ksztalt meczu na publicznych widokach: odliczanie, data i status.
//
// To ten kod decyduje, czy odwiedzajacy widzi mecz jako LIVE, LOCKED czy OPEN,
// wiec pomylka tutaj jest widoczna dla wszystkich od razu.
//
// Funkcje czytaja Date.now() same z siebie, dlatego testy podaja czasy wyraznie
// w przeszlosci albo przyszlosci i dokladaja pol minuty zapasu - inaczej
// zaokraglenie w dol potrafiloby zrobic z "30m" wynik "29m" w trakcie testu.

const test = require("node:test");
const assert = require("node:assert/strict");

const PUBLIC_MATCH = "../server/lib/publicMatch.js";

const MINUTA = 60 * 1000;
const GODZINA = 60 * MINUTA;

function za(ms) {
  return new Date(Date.now() + ms).toISOString();
}

test("odliczanie: bez daty TBA, po starcie LIVE", async () => {
  const { getPublicCountdown } = await import(PUBLIC_MATCH);

  assert.equal(getPublicCountdown(null), "TBA");
  assert.equal(getPublicCountdown(undefined), "TBA");
  assert.equal(getPublicCountdown(za(-GODZINA)), "LIVE");
});

test("odliczanie: ponizej godziny same minuty, powyzej godziny i minuty", async () => {
  const { getPublicCountdown } = await import(PUBLIC_MATCH);

  assert.equal(getPublicCountdown(za(30 * MINUTA + 30 * 1000)), "30m");
  assert.equal(getPublicCountdown(za(2 * GODZINA + 5 * MINUTA + 30 * 1000)), "2h 5m");
});

test("data: bez daty komunikat zastepczy, z data ISO", async () => {
  const { formatPublicDate } = await import(PUBLIC_MATCH);

  assert.equal(formatPublicDate(null), "Start time TBA");

  const kiedy = "2026-09-11T18:00:00.000Z";
  assert.equal(formatPublicDate(kiedy), kiedy);
});

test("status: blokada wygrywa z czasem", async () => {
  const { getPublicMatchStatus } = await import(PUBLIC_MATCH);

  // Mecz zablokowany recznie jest LOCKED, nawet jesli jego czas juz minal.
  assert.equal(
    getPublicMatchStatus({ is_locked: 1, start_time_utc: za(-GODZINA) }),
    "LOCKED",
  );
});

test("status: po czasie LIVE, przed czasem i bez czasu OPEN", async () => {
  const { getPublicMatchStatus } = await import(PUBLIC_MATCH);

  assert.equal(
    getPublicMatchStatus({ is_locked: 0, start_time_utc: za(-MINUTA) }),
    "LIVE",
  );
  assert.equal(
    getPublicMatchStatus({ is_locked: 0, start_time_utc: za(GODZINA) }),
    "OPEN",
  );
  assert.equal(
    getPublicMatchStatus({ is_locked: 0, start_time_utc: null }),
    "OPEN",
    "mecz bez ustalonego terminu jest otwarty, a nie LIVE",
  );
});

test("mecz publiczny: FINAL bije wszystko, wynik na tablicy znaczy LIVE", async () => {
  const { buildPublicMatch } = await import(PUBLIC_MATCH);

  const zakonczony = buildPublicMatch({
    id: 1,
    live_status: "FINAL",
    is_locked: 0,
    start_time_utc: za(GODZINA),
  });
  assert.equal(zakonczony.ui_status, "FINAL");

  // Jakikolwiek punkt na tablicy znaczy, ze mecz sie toczy - nawet jesli
  // zaplanowany czas startu jeszcze nie minal.
  const trwajacy = buildPublicMatch({
    id: 2,
    score_a: 1,
    score_b: 0,
    is_locked: 0,
    start_time_utc: za(GODZINA),
  });
  assert.equal(trwajacy.ui_status, "LIVE");
});

test("mecz publiczny: bez wyniku i bez FINAL status bierze sie z czasu", async () => {
  const { buildPublicMatch } = await import(PUBLIC_MATCH);

  const przyszly = buildPublicMatch({
    id: 3,
    is_locked: 0,
    start_time_utc: za(GODZINA),
  });
  assert.equal(przyszly.ui_status, "OPEN");

  const zablokowany = buildPublicMatch({
    id: 4,
    is_locked: 1,
    start_time_utc: za(GODZINA),
  });
  assert.equal(zablokowany.ui_status, "LOCKED");
});

test("mecz publiczny: braki schodza do liczb i wartosci domyslnych", async () => {
  const { buildPublicMatch } = await import(PUBLIC_MATCH);

  const pusty = buildPublicMatch({ id: 5 });

  assert.equal(pusty.score_a, 0);
  assert.equal(pusty.score_b, 0);
  assert.equal(pusty.current_map, 1, "domyslnie pierwsza mapa, nie undefined");
  assert.equal(pusty.live_status, null);
});
