// Skad API bierze konfiguracje (server/lib/env.js).
//
// `dotenv.config()` bez sciezki czyta `.env` z KATALOGU ROBOCZEGO, a ten sam
// server/app.js startuje na dwa sposoby o roznych katalogach roboczych:
// PM2 z `server/`, Plesk z korzenia repo. Skutek byl taki, ze zmienna wpisana
// do `server/.env` dzialala pod PM2 i nie dzialala pod Pleskiem - bez zadnego
// sygnalu, po prostu `undefined`. Stracilismy na to runde diagnostyki przy
// WEB_ORIGIN_SUFFIX.
//
// Testy pilnuja dwoch rzeczy: ze sciezki licza sie wzgledem modulu (a nie
// katalogu roboczego) i ze kolejnosc pierwszenstwa jest taka, jak opisana -
// srodowisko przed server/.env, server/.env przed plikiem bota.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ENV = "../server/lib/env.js";

test("kolejnosc plikow: najpierw server/.env, potem plik bota", async () => {
  const { envFiles } = await import(ENV);

  const pliki = envFiles(path.join("/aplikacja", "server"));

  assert.equal(pliki.length, 2);
  assert.equal(path.basename(pliki[0]), ".env");
  assert.equal(path.basename(path.dirname(pliki[0])), "server");
  assert.equal(path.basename(pliki[1]), ".env");
  assert.equal(
    path.resolve(path.dirname(pliki[1])),
    path.resolve("/aplikacja"),
    "drugi plik to .env z katalogu NAD server/",
  );
});

test("sciezki nie zaleza od katalogu roboczego", async () => {
  const { envFiles } = await import(ENV);

  // To jest cala istota poprawki: ta sama odpowiedz niezaleznie od tego,
  // skad proces zostal uruchomiony.
  const a = envFiles("/aplikacja/server");

  const poprzedni = process.cwd();
  process.chdir(os.tmpdir());

  try {
    assert.deepEqual(envFiles("/aplikacja/server"), a);
  } finally {
    process.chdir(poprzedni);
  }
});

test("dotenv wolany raz na plik, w kolejnosci", async () => {
  const { loadEnvironment } = await import(ENV);

  const wywolania = [];
  const atrapa = {
    config(opcje) {
      wywolania.push(opcje);
    },
  };

  const zwrocone = loadEnvironment("/aplikacja/server", atrapa);

  assert.equal(wywolania.length, 2);
  assert.deepEqual(
    wywolania.map((o) => o.path),
    zwrocone,
    "config dostaje dokladnie te sciezki, ktore funkcja oddaje wolajacemu",
  );

  assert.ok(
    wywolania.every((o) => !o.override),
    "override musi zostac wylaczone - wlaczenie odwraca pierwszenstwo",
  );
});

test("pierwszenstwo: srodowisko > server/.env > plik bota", async () => {
  const { loadEnvironment } = await import(ENV);
  const dotenv = require("dotenv");

  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), "pickem-env-"));
  const katalogServer = path.join(katalog, "server");
  fs.mkdirSync(katalogServer);

  // TYLKO_BOT jest w pliku bota, TYLKO_API w pliku API, OBA w obu,
  // ZE_SRODOWISKA jest juz ustawione zanim cokolwiek wczytamy.
  fs.writeFileSync(
    path.join(katalog, ".env"),
    "TYLKO_BOT=bot\nOBA=z-pliku-bota\nZE_SRODOWISKA=z-pliku-bota\n",
  );
  fs.writeFileSync(
    path.join(katalogServer, ".env"),
    "TYLKO_API=api\nOBA=z-pliku-api\nZE_SRODOWISKA=z-pliku-api\n",
  );

  const kopia = { ...process.env };
  process.env.ZE_SRODOWISKA = "z-srodowiska";
  delete process.env.TYLKO_BOT;
  delete process.env.TYLKO_API;
  delete process.env.OBA;

  try {
    loadEnvironment(katalogServer, dotenv);

    assert.equal(
      process.env.TYLKO_API,
      "api",
      "konfiguracja API ma dojsc - to jest ta, ktora nie dochodzila pod Pleskiem",
    );
    assert.equal(
      process.env.TYLKO_BOT,
      "bot",
      "plik bota uzupelnia to, czego nie ma wyzej (dostep do bazy)",
    );
    assert.equal(
      process.env.OBA,
      "z-pliku-api",
      "przy konflikcie wygrywa konfiguracja API, nie plik bota",
    );
    assert.equal(
      process.env.ZE_SRODOWISKA,
      "z-srodowiska",
      "panel hostingu bije oba pliki - inaczej wdrozenie nie da sie nadpisac",
    );
  } finally {
    for (const klucz of Object.keys(process.env)) {
      if (!(klucz in kopia)) delete process.env[klucz];
    }
    Object.assign(process.env, kopia);
    fs.rmSync(katalog, { recursive: true, force: true });
  }
});

test("brakujacy plik nie wywraca startu", async () => {
  const { loadEnvironment } = await import(ENV);
  const dotenv = require("dotenv");

  // Na hostingu, gdzie cala konfiguracja idzie z panelu, zadnego .env moze
  // nie byc. dotenv zglasza to w `error`, ale nie rzuca - a start serwera
  // nie moze zalezec od obecnosci pliku.
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), "pickem-env-pusty-"));

  try {
    assert.doesNotThrow(() =>
      loadEnvironment(path.join(katalog, "server"), dotenv),
    );
  } finally {
    fs.rmSync(katalog, { recursive: true, force: true });
  }
});
