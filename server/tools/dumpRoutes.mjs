// Wypisuje tablice tras zbudowanej aplikacji do pliku podanego w argumencie.
//
// Dziala tylko dlatego, ze app.js buduje aplikacje, ale jej nie uruchamia -
// gdyby nasluchiwal, samo zaimportowanie zajeloby porty 3301 i 27500.
//
// Wynik idzie do pliku, a nie na stdout, bo dotenv wypisuje tam swoj baner.
// Proces konczy sie jawnie, bo magazyn sesji trzyma interwal czyszczenia.

import fs from "fs";

import { app, sessionStore } from "../app.js";

const target = process.argv[2];

if (!target) {
  console.error("uzycie: node tools/dumpRoutes.mjs <plik-wyjsciowy>");
  process.exit(2);
}

const stack = app.router?.stack ?? app._router?.stack ?? [];

const routes = [];

for (const layer of stack) {
  if (!layer.route) continue;

  const methods = Object.keys(layer.route.methods)
    .map((m) => m.toUpperCase())
    .sort();

  // Kolejnosc rejestracji ma znaczenie - w Expressie wygrywa pierwsza
  // pasujaca trasa - wiec listy NIE sortujemy.
  for (const m of methods) routes.push(`${m} ${String(layer.route.path)}`);
}

fs.writeFileSync(target, JSON.stringify(routes, null, 2) + "\n", "utf8");

try {
  await sessionStore.close();
} catch {
  // przy samym listowaniu nieistotne
}

process.exit(0);
