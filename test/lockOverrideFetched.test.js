// Czy kazde miejsce liczace blokade meczu POBIERA kolumne, od ktorej
// ta blokada zalezy.
//
// isMatchLocked() patrzy NAJPIERW na `lock_override`. Wiersz pobrany bez
// tej kolumny ma ja jako undefined, funkcja schodzi wiec na `is_locked`
// i zegar - i odpowiada inaczej, niz wynika z decyzji admina. Nic przy tym
// nie rzuca bledem: zapytanie sie wykonuje, funkcja zwraca wartosc, tylko
// nieprawdziwa.
//
// Ten sam blad wyszedl juz TRZY RAZY, za kazdym razem w innym pliku:
//   2026-11-26  server/lib/publicMatch.js i przeglad publiczny (PR #177)
//   2026-11-27  handlers/matches/openMatchPick.js (PR #178)
//   2026-11-27  handlers/matches/matchPickSelect.js - "odblokowalem mecz
//               na www, a bot dalej pisze, ze zablokowany"
//
// Stad ten test: nastepny raz ma wyjsc tutaj, a nie u gracza.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

const KATALOGI = ["handlers", "utils", "services", "server"];

/**
 * Pliki, ktore wolaja isMatchLocked na wierszu DOSTARCZONYM Z ZEWNATRZ.
 *
 * Nie maja wlasnego zapytania, wiec nie maja czego pobierac - za komplet
 * kolumn odpowiada wywolujacy. Kazdy wpis wymaga powodu.
 */
const DOSTAJE_WIERSZ_OD_WYWOLUJACEGO = {
  "server/lib/predictionGate.js":
    "czysta funkcja bramki - mecz przychodzi parametrem z trasy",
  "utils/matchLock.js": "to jest sama regula",
};

function pliki(katalog) {
  const wynik = [];

  for (const wpis of fs.readdirSync(katalog, { withFileTypes: true })) {
    if (wpis.name === "node_modules") continue;

    const pelna = path.join(katalog, wpis.name);

    if (wpis.isDirectory()) wynik.push(...pliki(pelna));
    else if (wpis.name.endsWith(".js")) wynik.push(pelna);
  }

  return wynik;
}

function wszystkieZrodla() {
  const wynik = [];

  for (const katalog of KATALOGI) {
    const sciezka = path.join(ROOT, katalog);

    if (!fs.existsSync(sciezka)) continue;

    wynik.push(...pliki(sciezka));
  }

  return wynik;
}

test("kazdy, kto liczy blokade, pobiera lock_override", () => {
  const winni = [];

  for (const plik of wszystkieZrodla()) {
    const rel = path.relative(ROOT, plik).replace(/\\/g, "/");

    const tresc = fs.readFileSync(plik, "utf8");

    // Samo WYWOLANIE, nie import ani przekazanie dalej w obiekcie zaleznosci.
    if (!/isMatchLocked\s*\(/.test(tresc)) continue;

    if (DOSTAJE_WIERSZ_OD_WYWOLUJACEGO[rel]) continue;

    // Wiersz z kompletem kolumn moze przyjsc na trzy sposoby.
    const maKolumne =
      tresc.includes("lock_override") ||
      /SELECT\s+\*/i.test(tresc) ||
      tresc.includes("getMatchById");

    if (!maKolumne) winni.push(rel);
  }

  assert.deepEqual(
    winni,
    [],
    "te pliki licza blokade z niepelnego wiersza - isMatchLocked() nie " +
      "zobaczy w nich recznej decyzji admina:\n  " + winni.join("\n  "),
  );
});

test("lista wyjatkow nie zawiera plikow, ktore maja wlasne zapytanie", () => {
  // Zeby wyjatek nie stal sie wygodna wymowka: plik na liscie nie moze
  // sam pytac bazy o mecz.
  for (const [rel, powod] of Object.entries(DOSTAJE_WIERSZ_OD_WYWOLUJACEGO)) {
    const pelna = path.join(ROOT, rel);

    assert.ok(fs.existsSync(pelna), `wyjatek wskazuje nieistniejacy plik: ${rel}`);
    assert.ok(powod && powod.length > 10, `wyjatek bez powodu: ${rel}`);

    const tresc = fs.readFileSync(pelna, "utf8");

    assert.ok(
      !/FROM\s+matches\b/i.test(tresc),
      `${rel} ma wlasne zapytanie o mecze, wiec nie moze byc wyjatkiem`,
    );
  }
});

test("regula naprawde patrzy najpierw na lock_override", () => {
  // Gdyby kolejnosc w utils/matchLock.js sie odwrocila, caly ten test
  // pilnowalby czegos, co przestalo mieć znaczenie.
  const { isMatchLocked } = require("../utils/matchLock");

  const poStarcie = {
    is_locked: 1,
    start_time_utc: "2020-01-01T00:00:00.000Z",
  };

  assert.equal(
    isMatchLocked({ ...poStarcie, lock_override: 0 }),
    false,
    "reczne otwarcie nie wygrywa z kolumna i zegarem",
  );

  assert.equal(
    isMatchLocked({ ...poStarcie, is_locked: 0, lock_override: 1 }),
    true,
    "reczne zamkniecie nie wygrywa",
  );

  // I to jest dokladnie ten przypadek, ktory psul sie w praktyce:
  // brak kolumny w wierszu daje inna odpowiedz niz jej obecnosc.
  assert.notEqual(
    isMatchLocked({ ...poStarcie, lock_override: 0 }),
    isMatchLocked(poStarcie),
    "bez lock_override funkcja odpowiada tak samo - test bylby bezcelowy",
  );
});
