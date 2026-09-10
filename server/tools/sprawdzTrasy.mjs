// Porownuje tablice tras z zapisanym wzorcem (trasy.snapshot.json).
//
// Po co: server/app.js ma ponad 12 tysiecy linii i 96 rejestracji tras
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
//   npm run trasy:zapisz

import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WZORZEC = path.join(__dirname, "..", "trasy.snapshot.json");

function zbierz(tryb) {
  const plik = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "trasy-")),
    "trasy.json",
  );

  const wynik = spawnSync(
    process.execPath,
    [path.join(__dirname, "wypiszTrasy.mjs"), plik],
    {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, NODE_ENV: tryb },
      encoding: "utf8",
      timeout: 120000,
    },
  );

  if (wynik.status !== 0) {
    console.error(`[trasy] nie udalo sie zbudowac aplikacji w trybie ${tryb}`);
    console.error(wynik.stderr || wynik.stdout);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(plik, "utf8"));
}

const biezace = {
  dev: zbierz("development"),
  prod: zbierz("production"),
};

if (process.argv.includes("--zapisz")) {
  fs.writeFileSync(WZORZEC, JSON.stringify(biezace, null, 2) + "\n", "utf8");
  console.log(
    `[trasy] wzorzec zapisany: dev ${biezace.dev.length}, prod ${biezace.prod.length}`,
  );
  process.exit(0);
}

if (!fs.existsSync(WZORZEC)) {
  console.error("[trasy] brak wzorca - uruchom: npm run trasy:zapisz");
  process.exit(1);
}

const wzorzec = JSON.parse(fs.readFileSync(WZORZEC, "utf8"));

let bledy = 0;

for (const tryb of ["dev", "prod"]) {
  const oczekiwane = wzorzec[tryb] ?? [];
  const jest = biezace[tryb];

  const brakuje = oczekiwane.filter((t) => !jest.includes(t));
  const nadmiar = jest.filter((t) => !oczekiwane.includes(t));

  // Rozna kolejnosc przy tej samej zawartosci tez jest bledem.
  const przestawione =
    brakuje.length === 0 &&
    nadmiar.length === 0 &&
    JSON.stringify(oczekiwane) !== JSON.stringify(jest);

  if (brakuje.length || nadmiar.length || przestawione) {
    bledy += 1;
    console.error(`\n[trasy] ${tryb}: ROZJAZD`);
    if (brakuje.length) console.error("  zniklo:", brakuje.join(", "));
    if (nadmiar.length) console.error("  doszlo:", nadmiar.join(", "));
    if (przestawione) console.error("  zmieniona kolejnosc rejestracji");
  } else {
    console.log(`[trasy] ${tryb}: ${jest.length} tras, zgodne`);
  }
}

if (bledy) {
  console.error(
    "\nJesli zmiana tras jest zamierzona: npm run trasy:zapisz\n" +
      "Jesli nie - to regresja z rozbijania app.js.",
  );
  process.exit(1);
}

console.log("[trasy] tablica tras bez zmian");
