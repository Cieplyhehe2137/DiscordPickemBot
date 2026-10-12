// Watcher map po veto (handlers/matches/matchMapsWatcher.js).
//
// Watcher ma dwa sposoby, zeby zawiesc po cichu, i oba sa gorsze od bledu:
//
//   1. NIE WYSTARTOWAC. Nikt tego nie zauwazy - mapy po prostu nie beda sie
//      pojawiac, tak jak nie pojawialy sie przedtem.
//   2. PRZEPALIC BUDZET. Darmowy plan dostawcy to 500 zapytan na MIESIAC,
//      a watcher tyka co pol godziny. Przekroczenie limitu to nie
//      "wolniej", tylko utrata dostepu.
//
// Stad te testy. Czytaja takze zrodla, bo czesci tego nie da sie sprawdzic
// inaczej niz patrzac, czy kod jest wpiety tam, gdzie powinien.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const KORZEN = path.join(__dirname, "..");

function czytaj(wzgledna) {
  return fs.readFileSync(path.join(KORZEN, wzgledna), "utf8").replace(/\r\n/g, "\n");
}

/* ---------------- wpiecie ---------------- */

test("watcher JEST URUCHAMIANY przy starcie guilda", () => {
  // Bez tego caly ten plik jest martwym kodem, a objaw - brak map - wyglada
  // dokladnie tak samo jak stan sprzed calej roboty.
  const onReady = czytaj("onReady.js");

  assert.match(
    onReady,
    /require\(["']\.\/handlers\/matches\/matchMapsWatcher["']\)/,
    "onReady.js nie importuje watchera map",
  );

  assert.match(
    onReady,
    /startMatchMapsWatcher\(client, guildId\)/,
    "onReady.js nie uruchamia watchera map",
  );
});

test("watcher JEST ZATRZYMYWANY przy zamykaniu bota", () => {
  // Timer, ktory przezyje zamkniecie, potrafi wystartowac zapytanie do puli,
  // ktora wlasnie sie zamyka - i bot konczy sie bledem zamiast cicho.
  const index = czytaj("index.js");

  assert.match(
    index,
    /stopMatchMapsWatchers/,
    "index.js nie zatrzymuje watchera map przy zamykaniu",
  );
});

test("start watchera jest raportowany w podsumowaniu guilda", () => {
  // Podsumowanie startu to jedyne miejsce, w ktorym widac, ze cos nie
  // wstalo. Watcher poza nim moze nie dzialac tygodniami.
  const onReady = czytaj("onReady.js");

  assert.match(onReady, /matchMapsWatcher:\s*matchMapsWatcherOk/);
});

/* ---------------- jedna droga zapisu ---------------- */

test("watcher NIE MA WLASNEGO zapisu do match_maps", () => {
  // Parowanie i zapis siedza w server/lib/mapSync.js, wspolnym ze skryptem.
  // Druga kopia rozjechalaby sie o jeden warunek - ten projekt zaplacil juz
  // za taka pomylke pol roku bledu (server/lib/startTime.js).
  const watcher = czytaj("handlers/matches/matchMapsWatcher.js");

  assert.doesNotMatch(
    watcher,
    /INSERT INTO match_maps/i,
    "watcher zapisuje mapy po swojemu, zamiast przez mapSync",
  );

  assert.match(
    watcher,
    /mapSync\.js/,
    "watcher nie siega po wspolna droge zapisu",
  );
});

test("skrypt i watcher ida TA SAMA droga", () => {
  const skrypt = czytaj("scripts/fetchMatchMaps.mjs");

  assert.match(skrypt, /mapSync\.js/);
  assert.doesNotMatch(
    skrypt,
    /INSERT INTO match_maps/i,
    "skrypt zapisuje mapy po swojemu, zamiast przez mapSync",
  );
});

/* ---------------- budzet ---------------- */

test("DOMYSLNE USTAWIENIA mieszcza sie w 500 zapytaniach na miesiac", () => {
  // To jest arytmetyka, ktorej nikt nie zrobi w glowie przy zmianie stalej.
  // Przy domyslnym limicie dziennym i najgorszym miesiacu musi wyjsc
  // ponizej 500 - inaczej dostawca odetnie dostep w polowie turnieju.
  const watcher = czytaj("handlers/matches/matchMapsWatcher.js");

  const limit = Number(
    /MAP_SYNC_MAX_PER_DAY \|\| (\d+)/.exec(watcher)?.[1] ?? NaN,
  );

  assert.ok(Number.isFinite(limit), "nie znalazlem domyslnego limitu dziennego");

  assert.ok(
    limit * 31 <= 500,
    `limit ${limit}/dobe to ${limit * 31} zapytan w najdluzszym miesiacu - powyzej 500`,
  );
});

test("odstep tykniec ma PODLOGE, nie tylko wartosc domyslna", () => {
  // Bez podlogi wystarczy literowka w zmiennej srodowiskowej
  // (MAP_SYNC_INTERVAL_SEC=3 zamiast 300), zeby watcher zaczal pytac
  // dostawce dwadziescia razy na minute.
  const watcher = czytaj("handlers/matches/matchMapsWatcher.js");

  assert.match(
    watcher,
    /Math\.max\(\s*300_000/,
    "brak dolnej granicy odstepu miedzy tyknieciami",
  );
});

test("watcher pyta NAJPIERW WLASNEJ BAZY, czy jest o co pytac", () => {
  // Poza turniejem ma nie isc ani jedno zapytanie do dostawcy. Bez tego
  // warunku 48 tyknieć na dobe to 48 zapytan, takze w miesiacu bez
  // jednego meczu.
  const watcher = czytaj("handlers/matches/matchMapsWatcher.js");

  const tresc = watcher.replace(/\/\/[^\n]*/g, "");

  assert.match(
    tresc,
    /if \(!turnieje\.length\) return;/,
    "watcher nie przerywa, gdy nie ma turniejow do sprawdzenia",
  );
});

test("bez klucza watcher w ogole nie startuje", () => {
  // Inaczej co pol godziny leciałby blad do logow za cos, co jest
  // normalnym stanem instalacji bez klucza.
  const watcher = czytaj("handlers/matches/matchMapsWatcher.js");

  assert.match(watcher, /if \(!process\.env\.CITO_API_KEY\)/);
});

/* ---------------- klucz w DOBRYM pliku ---------------- */

/*
 * TO SIE JUZ ZDARZYLO, pierwszego dnia po wdrozeniu.
 *
 * Klucz wpisano do server/.env - bo tam stoja DB_*, SESSION_SECRET i cala
 * reszta sekretow, i bo tak kazal komunikat skryptu. Skrypt dociagajacy mapy
 * czyta OBA pliki, wiec dzialal i klucz wygladal na ustawiony. Bot jest
 * osobnym procesem i laduje WYLACZNIE swoj .env z korzenia (index.js:
 * ENV_FILE || ".env"), wiec watcher nie wystartowal.
 *
 * Objaw: brak map. Czyli dokladnie to samo, co przed cala ta robota - i
 * dlatego nikt by tego nie zauwazyl bez zajrzenia w logi bota.
 */

test("komunikat o braku klucza MOWI, w ktorym pliku szukal", () => {
  // Bez nazwy pliku ten log nie prowadzi do przyczyny - a jest jedynym
  // sladem, jaki watcher po sobie zostawia, kiedy nie wstaje.
  const watcher = czytaj("handlers/matches/matchMapsWatcher.js");

  const komunikat =
    /logInfo\(\s*"matches",\s*"Watcher map nie startuje:[\s\S]*?\{ guildId: klucz \}/.exec(
      watcher,
    )?.[0] ?? "";

  assert.ok(komunikat, "nie znalazlem komunikatu o braku klucza");

  assert.match(
    komunikat,
    /process\.env\.ENV_FILE \|\| "\.env"/,
    "komunikat nie podaje pliku env, w ktorym bot szukal klucza",
  );

  assert.match(
    komunikat,
    /server\/\.env/,
    "komunikat nie ostrzega, ze server/.env to nie ten plik",
  );
});

test("klucz jest opisany w .env.example BOTA, nie tylko serwera", () => {
  // Operator czyta ten plik, kiedy stawia bota. Gdyby opis klucza zostal
  // tylko w server/.env.example, trafilby z nim do pliku, ktorego bot nie
  // czyta - i watcher znow by nie wstal.
  const korzen = czytaj(".env.example");

  assert.match(korzen, /^CITO_API_KEY=/m, ".env.example bota nie opisuje klucza");

  // I musi stac przy nim ostrzezenie, bo sam wpis niczego nie tlumaczy.
  const opis = korzen.slice(0, korzen.indexOf("CITO_API_KEY="));

  assert.match(
    opis.split("# Klucz do CitoAPI").pop() || "",
    /server\/\.env/,
    "opis klucza nie ostrzega przed wpisaniem go do server/.env",
  );
});

/* ---------------- moduł daje sie zaladowac ---------------- */

test("watcher laduje sie i oddaje obie funkcje", () => {
  // Bot jest na CommonJS, a mapSync na ESM - to pierwsze takie polaczenie
  // w tym projekcie. Jesli import sie wysypie, watcher nie wstanie,
  // a dowiemy sie o tym dopiero z logow produkcji.
  const modul = require("../handlers/matches/matchMapsWatcher.js");

  assert.equal(typeof modul.startMatchMapsWatcher, "function");
  assert.equal(typeof modul.stopMatchMapsWatchers, "function");

  // Bez wystartowanych timerow zatrzymanie ma byc bezpieczne.
  assert.equal(modul.stopMatchMapsWatchers(), 0);
});

test("mapSync da sie zaimportowac z CommonJS", async () => {
  // Bot wola `await import()` na module ESM. Ten test pilnuje, ze droga
  // jest przejezdna - czyli ze mapSync nie wciagnal po drodze niczego,
  // czego CJS nie uniesie.
  const mapSync = await import("../server/lib/mapSync.js");

  assert.equal(typeof mapSync.syncEventMaps, "function");
  assert.equal(typeof mapSync.znajdzMeczeDoUzupelnienia, "function");
  assert.equal(typeof mapSync.OKNO_DNI, "number");
  assert.equal(typeof mapSync.MINUT_PO_STARCIE, "number");
});
