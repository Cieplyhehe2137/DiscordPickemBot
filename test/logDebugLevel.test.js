// Poziom debug w loggerze (utils/logger.js).
//
// Piec komunikatow "No ... data, skipping phase" szlo jako ostrzezenia,
// a znaczyly tylko tyle, ze turniej nie ma danej fazy. Zajmowaly 94% pliku
// warnings.log - 1195 linii z 1277 - i topily w sobie te dwadziescia kilka,
// ktore naprawde cos znaczyly.
//
// Zjechaly na `debug`, czyli domyslnie nigdzie. Zeby to nie bylo kasowanie
// wpisow okrezna droga, jest LOG_LEVEL: ustawiony na "debug" wlacza je z
// powrotem, gdy ktos ich potrzebuje.
//
// Testy uruchamiaja logger w OSOBNYM procesie, bo pod uruchamiaczem testow
// wszystkie transporty sa wyciszone i w samym tescie nie dalo by sie
// zobaczyc niczego. Proces potomny dostaje wlasny katalog roboczy, zeby nie
// dopisywac sie do prawdziwych logow, i wyczyszczone NODE_TEST_CONTEXT -
// bez tego odziedziczylby je po rodzicu i tez by zamilkl.

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const LOGGER = path.join(__dirname, "..", "utils", "logger.js");

function uruchomLogger({ LOG_LEVEL } = {}) {
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), "pickem-log-"));

  // Kopia srodowiska BEZ znacznikow uruchamiacza testow - inaczej proces
  // potomny uznalby, ze sam jest testem, i wyciszyl wszystko.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_ENV;

  if (LOG_LEVEL) env.LOG_LEVEL = LOG_LEVEL;
  else delete env.LOG_LEVEL;

  const wynik = spawnSync(
    process.execPath,
    [
      "-e",
      `const { logDebug, logWarn } = require(${JSON.stringify(LOGGER)});
       logDebug("scores", "No Swiss data, skipping phase", { guildId: "111" });
       logWarn("scores", "PRAWDZIWE_OSTRZEZENIE", { guildId: "111" });`,
    ],
    { cwd: katalog, env, encoding: "utf8" },
  );

  const plikOstrzezen = path.join(katalog, "logs", "warnings.log");
  const plikOgolny = path.join(katalog, "logs", "bot.log");

  const czytaj = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");

  const odczyt = {
    konsola: `${wynik.stdout}${wynik.stderr}`,
    ostrzezenia: czytaj(plikOstrzezen),
    ogolny: czytaj(plikOgolny),
    kod: wynik.status,
  };

  fs.rmSync(katalog, { recursive: true, force: true });

  return odczyt;
}

test("domyslnie komunikat o brakujacej fazie nie trafia nigdzie", () => {
  const { konsola, ostrzezenia, ogolny, kod } = uruchomLogger();

  assert.equal(kod, 0, "proces ma sie skonczyc bez bledu");

  assert.ok(
    !konsola.includes("No Swiss data"),
    "nie ma go na konsoli",
  );
  assert.ok(
    !ostrzezenia.includes("No Swiss data"),
    "nie ma go w warnings.log - to jest cel calej zmiany",
  );
  assert.ok(
    !ogolny.includes("No Swiss data"),
    "nie ma go tez w bot.log",
  );
});

test("prawdziwe ostrzezenie nadal przechodzi", () => {
  // Wyciszenie szumu nie moze wyciszyc sygnalu.
  const { konsola, ostrzezenia } = uruchomLogger();

  assert.ok(ostrzezenia.includes("PRAWDZIWE_OSTRZEZENIE"), "warnings.log");
  assert.ok(konsola.includes("PRAWDZIWE_OSTRZEZENIE"), "konsola");
});

test("LOG_LEVEL=debug przywraca komunikat", () => {
  // To jest roznica miedzy "zjechalo na debug" a "skasowane". Bez tego
  // logDebug bylby funkcja, ktorej wyniku nie da sie nigdy zobaczyc.
  const { konsola, ogolny } = uruchomLogger({ LOG_LEVEL: "debug" });

  assert.ok(konsola.includes("No Swiss data"), "konsola");
  assert.ok(ogolny.includes("No Swiss data"), "bot.log");
});

test("LOG_LEVEL=debug nie wpycha debugow do pliku ostrzezen", () => {
  // warnings.log ma zostac plikiem o jednej rzeczy, niezaleznie od poziomu.
  const { ostrzezenia } = uruchomLogger({ LOG_LEVEL: "debug" });

  assert.ok(!ostrzezenia.includes("No Swiss data"));
  assert.ok(ostrzezenia.includes("PRAWDZIWE_OSTRZEZENIE"));
});

test("logDebug jest eksportowany i nie wywraca sie przy wywolaniu", () => {
  const { logDebug } = require("../utils/logger.js");

  assert.equal(typeof logDebug, "function");
  assert.doesNotThrow(() => logDebug("scores", "cokolwiek", { guildId: "111" }));
});
