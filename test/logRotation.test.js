// Rotacja plikow logow (utils/logger.js).
//
// bot.log rosl bez konca - od maja do wrzesnia uzbieral 3 MB i przyciac go
// dalo sie tylko recznie. Teraz kazdy plik ma limit i liczbe kopii.
//
// Ze rotacja NAPRAWDE dziala, sprawdzilem osobno: zapis 6 MB przy limicie 5 MB
// dal bot1.log dokladnie 5.00 MB i bot.log z najswiezszymi 3.63 MB. Tego nie
// ma w tescie, bo kosztowalby kilka sekund i kilkanascie megabajtow w katalogu
// tymczasowym przy kazdym przebiegu - a sprawdzalby zachowanie winstona, nie
// nasze.
//
// Tutaj pilnujemy tego, co MY mozemy zepsuc: ustawien. Transport bez maxsize
// pisze bez konca i nie widac tego po niczym, dopoki dysk nie zacznie sie
// konczyc.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const LOGGER = path.join(__dirname, "..", "utils", "logger.js");

// Pod uruchamiaczem testow logger nie ma transportow plikowych w ogole, wiec
// ustawienia trzeba obejrzec w osobnym procesie - tak samo jak przy poziomach.
function ustawieniaTransportow() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_ENV;

  const wynik = spawnSync(
    process.execPath,
    [
      "-e",
      `const { logger } = require(${JSON.stringify(LOGGER)});
       const p = require("path");
       const opis = logger.transports
         .filter((t) => t.filename)
         .map((t) => ({
           plik: p.basename(t.filename),
           maxsize: t.maxsize,
           maxFiles: t.maxFiles,
           tailable: t.tailable,
         }));
       process.stdout.write(JSON.stringify(opis));`,
    ],
    { encoding: "utf8", env, cwd: require("node:os").tmpdir() },
  );

  return JSON.parse(wynik.stdout);
}

test("kazdy plik logow ma ustawiony limit i liczbe kopii", () => {
  const transporty = ustawieniaTransportow();

  assert.equal(transporty.length, 3, "bot.log, errors.log, warnings.log");

  for (const t of transporty) {
    assert.ok(
      Number.isInteger(t.maxsize) && t.maxsize > 0,
      `${t.plik}: bez maxsize plik rosnie bez konca`,
    );
    assert.ok(
      Number.isInteger(t.maxFiles) && t.maxFiles > 0,
      `${t.plik}: bez maxFiles stare kopie zostaja na zawsze`,
    );
  }
});

test("biezace wpisy zostaja pod ta sama nazwa", () => {
  // `tailable` przenosi STARE dane do bot1.log, a swieze zostawia w bot.log.
  // Bez tego winston robi odwrotnie i `tail -f logs/bot.log` przestaje
  // cokolwiek pokazywac po pierwszej rotacji - czyli wtedy, gdy jest ciekawie.
  const transporty = ustawieniaTransportow();

  for (const t of transporty) {
    assert.equal(t.tailable, true, `${t.plik}: ma zostac pod swoja nazwa`);
  }
});

test("limity sa w rozsadnych granicach", () => {
  const { ROTATION } = require("../utils/logger.js");

  // Plik ogolny moze byc grubszy niz pliki od jednej rzeczy.
  assert.ok(ROTATION.bot.maxsize >= ROTATION.warnings.maxsize);
  assert.ok(ROTATION.bot.maxsize >= ROTATION.errors.maxsize);

  // Bledy trzyma sie najdluzej - do nich wraca sie tydzien pozniej.
  assert.ok(ROTATION.errors.maxFiles >= ROTATION.bot.maxFiles);

  for (const [nazwa, ust] of Object.entries(ROTATION)) {
    assert.ok(
      ust.maxsize >= 512 * 1024,
      `${nazwa}: ponizej pol megabajta rotacja tnie w srodku zdarzenia`,
    );
    assert.ok(
      ust.maxsize <= 64 * 1024 * 1024,
      `${nazwa}: powyzej 64 MB to juz nie jest limit`,
    );
  }
});

test("najgorszy przypadek zajetosci dysku jest ograniczony", () => {
  // Liczba, ktora warto miec wypisana: inaczej "ma rotacje" brzmi jak
  // "nie zajmie duzo", a to nie to samo.
  const { ROTATION } = require("../utils/logger.js");

  const sufitMB = Object.values(ROTATION).reduce(
    (s, u) => s + (u.maxsize * u.maxFiles) / 1024 / 1024,
    0,
  );

  assert.ok(sufitMB <= 128, `sufit ${sufitMB} MB jest za wysoki jak na logi`);
  assert.ok(sufitMB >= 10, `sufit ${sufitMB} MB nie zostawia historii`);
});
