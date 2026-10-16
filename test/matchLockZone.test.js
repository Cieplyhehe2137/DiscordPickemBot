// Strefa czasowa w oknie godziny meczu i godzina zamkniecia typowania.
//
// Dwie usterki z jednego miejsca, obie o tym samym: ta sama liczba znaczyla
// co innego w dwoch czesciach projektu.
//
//   1. Okno "Ustaw godzine meczu" mialo etykiete "(UTC)", a wpisana wartosc
//      byla czytana jako czas warszawski. Administrator, ktory zaufal
//      etykiecie, dostawal mecz blokowany DWIE GODZINY PO STARCIE w czasie
//      letnim - czyli typowanie otwarte w trakcie gry.
//
//   2. MATCH_LOCK_BEFORE_SEC stalo tylko w server/.env, wiec strona zamykala
//      typowanie piec minut przed startem, a bot dokladnie o starcie.
//
// Zadna z nich nie daje bledu ani wpisu w logach. Pierwsza wyglada jak
// "ludzie typuja po czasie", druga jak "stronie sie przywidzialo".

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  DEFAULT_ZONE,
  DOMYSLNY_LOCK_BEFORE_SEC,
  getLockBeforeSec,
  parseStartInputToUtc,
} = require("../utils/matchLock");

const MODAL = path.join(
  __dirname,
  "..",
  "handlers",
  "matches",
  "openSetMatchTimeModal.js",
);

/* ---------------- co parser NAPRAWDE robi ---------------- */

test("parser czyta wpisana godzine jako czas POLSKI, nie UTC", () => {
  // Dowod na danych, a nie z nazwy stalej: 18:00 w lipcu to 16:00 UTC,
  // a w styczniu 17:00 UTC. Gdyby parser czytal UTC, oba wyszlyby 18:00.
  const lato = parseStartInputToUtc("2026-07-01 18:00");

  assert.equal(lato.ok, true);
  assert.equal(lato.utc.toFormat("HH:mm"), "16:00");

  const zima = parseStartInputToUtc("2026-01-15 18:00");

  assert.equal(zima.ok, true);
  assert.equal(zima.utc.toFormat("HH:mm"), "17:00");

  assert.equal(DEFAULT_ZONE, "Europe/Warsaw");
});

test("puste pole i slowo clear czyszcza godzine", () => {
  // Druga rzecz, ktorej nie da sie odgadnac z samego okna - stad wzmianka
  // w podpowiedzi pola.
  for (const wejscie of ["", "clear", "usun", "usuń", "none"]) {
    const wynik = parseStartInputToUtc(wejscie);

    assert.equal(wynik.ok, true, `"${wejscie}" nie zostalo przyjete`);
    assert.equal(wynik.cleared, true, `"${wejscie}" nie wyczyscilo godziny`);
  }
});

/* ---------------- etykieta musi mowic to, co parser robi ---------------- */

test("etykieta pola NIE MOWI o UTC", () => {
  const zrodlo = fs.readFileSync(MODAL, "utf8");

  const etykieta = /setLabel\(\s*"([^"]+)"\s*\)/.exec(zrodlo)?.[1];

  assert.ok(etykieta, "nie znalazlem etykiety pola w oknie godziny");

  assert.doesNotMatch(
    etykieta,
    /UTC/i,
    `etykieta mowi o UTC ("${etykieta}"), a parser czyta ${DEFAULT_ZONE}`,
  );
});

test("etykieta pola mowi, ze to czas polski", () => {
  // Sama nieobecnosc slowa "UTC" nie wystarcza - pole bez strefy jest
  // dokladnie tak samo mylace, tylko po cichu.
  const zrodlo = fs.readFileSync(MODAL, "utf8");

  const etykieta = /setLabel\(\s*"([^"]+)"\s*\)/.exec(zrodlo)?.[1];

  assert.match(
    etykieta,
    /polski|\bPL\b/i,
    `etykieta nie podaje strefy ("${etykieta}")`,
  );
});

/* ---------------- jedna godzina zamkniecia dla obu stron ---------------- */

test("bez zmiennej srodowiskowej obie strony licza TAK SAMO", () => {
  // To jest cala poprawka numer dwa: wartosc domyslna stoi w kodzie, wiec
  // proces, ktory nie ma tej zmiennej, nie liczy inaczej niz drugi.
  const przed = process.env.MATCH_LOCK_BEFORE_SEC;

  try {
    delete process.env.MATCH_LOCK_BEFORE_SEC;

    assert.equal(getLockBeforeSec(), DOMYSLNY_LOCK_BEFORE_SEC);
    assert.equal(DOMYSLNY_LOCK_BEFORE_SEC, 300);
  } finally {
    if (przed === undefined) delete process.env.MATCH_LOCK_BEFORE_SEC;
    else process.env.MATCH_LOCK_BEFORE_SEC = przed;
  }
});

test("PUSTA zmienna znaczy to samo co brak zmiennej", () => {
  // Plik env z "MATCH_LOCK_BEFORE_SEC=" nie moze zachowywac sie inaczej niz
  // plik bez tego klucza - inaczej wraca ta sama pulapka, tylko ciszej.
  const przed = process.env.MATCH_LOCK_BEFORE_SEC;

  try {
    process.env.MATCH_LOCK_BEFORE_SEC = "";
    assert.equal(getLockBeforeSec(), DOMYSLNY_LOCK_BEFORE_SEC);

    process.env.MATCH_LOCK_BEFORE_SEC = "   ";
    assert.equal(getLockBeforeSec(), DOMYSLNY_LOCK_BEFORE_SEC);
  } finally {
    if (przed === undefined) delete process.env.MATCH_LOCK_BEFORE_SEC;
    else process.env.MATCH_LOCK_BEFORE_SEC = przed;
  }
});

test("jawne zero nadal znaczy zero", () => {
  // Wartosc domyslna nie moze zabrac mozliwosci wylaczenia zapasu -
  // "zamykaj dokladnie o godzinie startu" to poprawne ustawienie.
  const przed = process.env.MATCH_LOCK_BEFORE_SEC;

  try {
    process.env.MATCH_LOCK_BEFORE_SEC = "0";
    assert.equal(getLockBeforeSec(), 0);

    process.env.MATCH_LOCK_BEFORE_SEC = "120";
    assert.equal(getLockBeforeSec(), 120);

    process.env.MATCH_LOCK_BEFORE_SEC = "nie-liczba";
    assert.equal(getLockBeforeSec(), DOMYSLNY_LOCK_BEFORE_SEC);
  } finally {
    if (przed === undefined) delete process.env.MATCH_LOCK_BEFORE_SEC;
    else process.env.MATCH_LOCK_BEFORE_SEC = przed;
  }
});

test("MATCH_LOCK_BEFORE_SEC jest opisane w .env.example bota", () => {
  // Zmienna, ktora w jednym pliku jest, a w drugim nie, to wlasnie zrodlo
  // tej usterki. Operator musi ja widziec tam, gdzie konfiguruje bota.
  const przyklad = fs.readFileSync(
    path.join(__dirname, "..", ".env.example"),
    "utf8",
  );

  assert.match(przyklad, /^MATCH_LOCK_BEFORE_SEC=/m);
  assert.match(przyklad, /server\/\.env/);
});
