// Logger nie pisze do plikow, kiedy chodza testy (utils/logger.js).
//
// Przed poprawka `npm test` dopisywal sie do prawdziwych logow bota: 2130
// z 11237 linii bot.log mialo guildId "111", czyli identyfikator z atrap
// w tym katalogu. Jeden przebieg to ponad osiem kilobajtow wpisow - a to jest
// plik, w ktorym potem szuka sie prawdziwych awarii. Logi szly przy okazji na
// konsole, wiec miedzy nazwy testow wpadalo po piec linii "No ... skipping
// phase" z kazdego pliku liczacego punkty.
//
// Ten test uruchamia sie POD uruchamiaczem testow, wiec sprawdza dokladnie te
// sciezke, o ktora chodzi: jesli wykrywanie przestanie dzialac, test zgasnie
// tutaj, a nie dopiero wtedy, gdy ktos zajrzy do logow za miesiac.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { logger, RUNNING_TESTS, logInfo, logWarn, logError } = require("../utils/logger.js");

test("wykrywa, ze chodzi pod uruchamiaczem testow", () => {
  assert.equal(RUNNING_TESTS, true);
});

test("nie ma ani jednego transportu piszacego do pliku", () => {
  // Sedno sprawy. Transport plikowy winstona ma pole `filename`.
  const doPliku = logger.transports.filter((t) => t.filename);

  assert.deepEqual(
    doPliku.map((t) => t.filename),
    [],
    "zaden transport nie moze wskazywac na plik",
  );
});

test("zostaje dokladnie jeden transport i jest wyciszony", () => {
  // Zero transportow nie wchodzi w gre: winston wypisuje wtedy ostrzezenie
  // przy KAZDYM wpisie, czyli halas zamiast ciszy.
  assert.equal(logger.transports.length, 1);
  assert.equal(logger.transports[0].silent, true);
});

test("pisanie do loggera nie tworzy ani nie zmienia plikow", () => {
  const logsDir = path.join(process.cwd(), "logs");

  const przed = fs.existsSync(logsDir)
    ? Object.fromEntries(
        fs
          .readdirSync(logsDir)
          .map((f) => [f, fs.statSync(path.join(logsDir, f)).size]),
      )
    : null;

  logInfo("TEST_WPIS", { guildId: "111" });
  logWarn("TEST_OSTRZEZENIE", { guildId: "111" });
  logError("TEST_BLAD", new Error("nie powinno nigdzie wyladowac"));

  const po = fs.existsSync(logsDir)
    ? Object.fromEntries(
        fs
          .readdirSync(logsDir)
          .map((f) => [f, fs.statSync(path.join(logsDir, f)).size]),
      )
    : null;

  assert.deepEqual(po, przed, "rozmiary plikow w logs/ maja zostac bez zmian");
});

test("logowanie nadal nie rzuca wyjatkiem", () => {
  // Wyciszenie ma znaczyc "nie zapisuj", a nie "przestan dzialac" - kod, ktory
  // loguje w bloku catch, nie moze sie przez to wywrocic.
  assert.doesNotThrow(() => {
    logInfo("scores", "stary format", { guildId: "111" });
    logError("COMMAND_ERROR", new Error("x"), { guildId: "111" });
  });
});
