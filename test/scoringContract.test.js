// Umowa miedzy rules/scoring.js a frontem.
//
// rules/scoring.js opisuje sam siebie jako jedyne zrodlo stalych punktowych.
// Przez dluzszy czas nim nie byl: te same jedenascie liczb stalo wpisanych
// wprost w web/src/components/PhaseResults.jsx. Naglowek rules/scoring.js
// opisuje, jak konczy sie taki uklad - plik pokazywal regulamin, ktorego bot
// nie stosowal (Swiss 4/4/2 zamiast 3/3/1, Playoffs 1/2/3/2 zamiast 2/3/5/2).
//
// Rozjazd stawek nie daje bledu ani wpisu w logach. Daje ekran z inna liczba
// punktow niz ranking, wiec wychodzi dopiero z reklamacji gracza. Te testy sa
// jedynym miejscem, ktore go widzi.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SCORING = require("../rules/scoring");

const MODUL = "../web/src/lib/scoring.js";

const PHASE_RESULTS = path.join(
  __dirname,
  "..",
  "web",
  "src",
  "components",
  "PhaseResults.jsx",
);

// Wszystkie stawki z regulaminu jako plaskie sciezki "KATEGORIA.KLUCZ".
function sciezkiRegulaminu() {
  const wynik = [];

  for (const [kategoria, stawki] of Object.entries(SCORING)) {
    for (const klucz of Object.keys(stawki)) {
      wynik.push(`${kategoria}.${klucz}`);
    }
  }

  return wynik;
}

// --- pointsAt --------------------------------------------------------------

test("pointsAt odroznia zero od braku stawki", async () => {
  // To jest cala trudnosc tej funkcji. MAP.MISS wynosi zero i jest prawdziwa
  // pozycja regulaminu, wiec "nie znalazlem" nie moze zwrocic tej samej
  // wartosci - inaczej literowka w nazwie klucza wyswietla sie na stronie
  // jako regulaminowe 0 pkt, czyli jako informacja zamiast jako brak.
  const { pointsAt } = await import(MODUL);

  assert.equal(pointsAt(SCORING, "MAP.MISS"), 0);
  assert.equal(pointsAt(SCORING, "MAP.NIE_MA_TAKIEGO"), null);
  assert.equal(pointsAt(SCORING, "NIE_MA.WCALE"), null);
});

test("pointsAt znosi brak calej punktacji", async () => {
  // Strona wola ta funkcje zanim odpowiedz z serwera dojdzie, a PhaseResults
  // takze wtedy, gdy strzal po punktacje sie nie udal. Wyjatek w tym miejscu
  // wywalilby caly widok wyniku fazy.
  const { pointsAt } = await import(MODUL);

  assert.equal(pointsAt(null, "MAP.EXACT"), null);
  assert.equal(pointsAt(undefined, "MAP.EXACT"), null);
  assert.equal(pointsAt({}, "MAP.EXACT"), null);
});

// --- tabela na stronie -----------------------------------------------------

test("kazda pozycja tabeli wskazuje na istniejaca stawke", async () => {
  const { SECTIONS, pointsAt } = await import(MODUL);

  for (const sekcja of SECTIONS) {
    for (const zasada of sekcja.rows) {
      assert.notEqual(
        pointsAt(SCORING, zasada.path),
        null,
        `sekcja "${sekcja.key}": ${zasada.path} nie istnieje w rules/scoring.js`,
      );
    }
  }
});

test("zadna stawka z regulaminu nie zostaje poza strona", async () => {
  // Kierunek odwrotny do poprzedniego testu. Bez niego stawka dopisana do
  // rules/scoring.js po prostu nie pojawia sie na stronie z zasadami i nic
  // tego nie zglasza - regulamin znowu zaczyna byc niepelny, tylko inaczej.
  const { SECTIONS } = await import(MODUL);

  const pokazane = new Set(
    SECTIONS.flatMap((sekcja) => sekcja.rows.map((zasada) => zasada.path)),
  );

  for (const sciezka of sciezkiRegulaminu()) {
    assert.ok(
      pokazane.has(sciezka),
      `${sciezka} jest w rules/scoring.js, ale nie ma go w SECTIONS`,
    );
  }
});

// --- wyniki fazy -----------------------------------------------------------

test("wyniki fazy nie maja wpisanej ani jednej stawki", async () => {
  // Dokladnie ten zapis stal tu wczesniej: punktyZa={4}, punktyZa={2},
  // punktyZa={3}, punktyZa={1} - jedenascie liczb bedacych druga kopia
  // regulaminu. Ten test jest jedynym, co powstrzymuje powrot takiej kopii.
  const kod = fs.readFileSync(PHASE_RESULTS, "utf8");

  const wpisane = kod.match(/punktyZa=\{\d+\}/g);

  assert.equal(
    wpisane,
    null,
    `stawki wpisane wprost zamiast z serwera: ${(wpisane || []).join(", ")}`,
  );
});

test("kazda stawka w wynikach fazy wskazuje na istniejaca pozycje", async () => {
  // Nazwa klucza jest tu zwyklym napisem, wiec literowka nie daje bledu -
  // daje wiersz bez dopisku o punktach, ktory wyglada jak faza bez punktacji.
  const { pointsAt } = await import(MODUL);

  const kod = fs.readFileSync(PHASE_RESULTS, "utf8");

  const uzyte = [...kod.matchAll(/punkty\("([^"]+)"\)/g)].map((m) => m[1]);

  assert.ok(uzyte.length > 0, "nie znalazlem ani jednego odczytu stawki");

  for (const sciezka of uzyte) {
    assert.notEqual(
      pointsAt(SCORING, sciezka),
      null,
      `${sciezka} nie istnieje w rules/scoring.js`,
    );
  }
});
