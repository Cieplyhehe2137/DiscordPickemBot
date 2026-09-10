// Porownuje tablice tras z zapisanym wzorcem (routes.snapshot.json).
//
// Po co: server/app.js ma prawie 12 tysiecy linii i 96 rejestracji tras
// przeplecionych ze soba - grupa `events` rozciaga sie od linii 999 do 11483,
// a w srodku siedza trasy z innych grup. Rozbijanie tego na moduly to
// przenoszenie kodu po calym pliku, a serwera nie da sie tu uruchomic, zeby
// sprawdzic efekt. Ten skrypt jest jedynym twardym dowodem, ze po przenosinach
// aplikacja rejestruje dokladnie te same trasy, w tej samej kolejnosci.
//
// Kolejnosc jest czescia kontraktu: w Expressie wygrywa pierwsza pasujaca
// trasa, wiec przestawienie dwoch tras potrafi zmienic zachowanie, nie zmieniac
// zawartosci.
//
// Sprawdzane sa oba tryby, bo kazdy rejestruje inny zestaw:
//   dev  - dodatkowo /api/auth/dev-login
//   prod - dodatkowo fallback SPA (sciezka regexowa)
//
// Aktualizacja wzorca (tylko gdy zmiana tras jest zamierzona):
//   npm run routes:save

import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = path.join(__dirname, "..", "routes.snapshot.json");

function collect(mode) {
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "routes-")),
    "routes.json",
  );

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "dumpRoutes.mjs"), file],
    {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, NODE_ENV: mode },
      encoding: "utf8",
      timeout: 120000,
    },
  );

  if (result.status !== 0) {
    console.error(`[routes] nie udalo sie zbudowac aplikacji w trybie ${mode}`);
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const current = {
  dev: collect("development"),
  prod: collect("production"),
};

if (process.argv.includes("--save")) {
  fs.writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2) + "\n", "utf8");
  console.log(
    `[routes] wzorzec zapisany: dev ${current.dev.length}, prod ${current.prod.length}`,
  );
  process.exit(0);
}

if (!fs.existsSync(SNAPSHOT)) {
  console.error("[routes] brak wzorca - uruchom: npm run routes:save");
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));

let mismatches = 0;

for (const mode of ["dev", "prod"]) {
  const expected = snapshot[mode] ?? [];
  const actual = current[mode];

  const missing = expected.filter((route) => !actual.includes(route));
  const extra = actual.filter((route) => !expected.includes(route));

  // Rozna kolejnosc przy tej samej zawartosci tez jest bledem.
  const reordered =
    missing.length === 0 &&
    extra.length === 0 &&
    JSON.stringify(expected) !== JSON.stringify(actual);

  if (missing.length || extra.length || reordered) {
    mismatches += 1;
    console.error(`\n[routes] ${mode}: ROZJAZD`);
    if (missing.length) console.error("  zniklo:", missing.join(", "));
    if (extra.length) console.error("  doszlo:", extra.join(", "));
    if (reordered) console.error("  zmieniona kolejnosc rejestracji");
  } else {
    console.log(`[routes] ${mode}: ${actual.length} tras, zgodne`);
  }
}

if (mismatches) {
  console.error(
    "\nJesli zmiana tras jest zamierzona: npm run routes:save\n" +
      "Jesli nie - to regresja z rozbijania app.js.",
  );
  process.exit(1);
}

console.log("[routes] tablica tras bez zmian");
