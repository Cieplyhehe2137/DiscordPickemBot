// Wypisuje tablice tras zbudowanej aplikacji do pliku podanego w argumencie.
//
// Dziala tylko dlatego, ze app.js buduje aplikacje, ale jej nie uruchamia -
// gdyby nasluchiwal, samo zaimportowanie zajeloby porty 3301 i 27500.
//
// Wynik idzie do pliku, a nie na stdout, bo dotenv wypisuje tam swoj baner.
// Proces konczy sie jawnie, bo magazyn sesji trzyma interwal czyszczenia.

import fs from "fs";

import { app, sessionStore } from "../app.js";

const cel = process.argv[2];

if (!cel) {
  console.error("uzycie: node tools/wypiszTrasy.mjs <plik-wyjsciowy>");
  process.exit(2);
}

const stos = app.router?.stack ?? app._router?.stack ?? [];

const trasy = [];

for (const warstwa of stos) {
  if (!warstwa.route) continue;

  const metody = Object.keys(warstwa.route.methods)
    .map((m) => m.toUpperCase())
    .sort();

  // Kolejnosc rejestracji ma znaczenie - w Expressie wygrywa pierwsza
  // pasujaca trasa - wiec listy NIE sortujemy.
  for (const m of metody) trasy.push(`${m} ${String(warstwa.route.path)}`);
}

fs.writeFileSync(cel, JSON.stringify(trasy, null, 2) + "\n", "utf8");

try {
  await sessionStore.close();
} catch {
  // przy samym listowaniu nieistotne
}

process.exit(0);
