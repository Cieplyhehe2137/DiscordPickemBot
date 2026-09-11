// Porownuje zaleznosci PRZEKAZANE do modulow tras z tymi, ktore moduly
// DESTRUKTURYZUJA.
//
// Po co osobne narzedzie:
//
//   registerPlayerProfileRoutes(app, { findNameFromPicks, pool });
//   export function registerPlayerProfileRoutes(app, { nazwaZTypow, pool })
//
// To jest poprawny JavaScript. Destrukturyzacja brakujacego klucza daje
// undefined, wiec ani `node --check`, ani eslint z regula no-undef nic tu
// nie zglosza. Kontrola tras tez nie, bo trasa rejestruje sie normalnie -
// funkcja jest undefined dopiero w momencie ZAPYTANIA. Efektem jest 500
// na produkcji, widoczny wylacznie wtedy, gdy ktos wejdzie na ten ekran.
//
// Dokladnie tak profil gracza przestal dzialac po zangielszczeniu nazw:
// zmieniona zostala jedna strona wywolania.
//
// Uruchomienie:
//   node server/tools/checkRouteDeps.mjs
//
// Zwraca 1, gdy cokolwiek sie nie zgadza.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Sciezki liczone od pliku, a nie od katalogu uruchomienia: skrypt npm
// odpala sie z server/, a CI i recznie wola go z korzenia repozytorium.
const KATALOG_SERWERA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const KATALOG_TRAS = path.join(KATALOG_SERWERA, "routes");
const PLIK_APP = path.join(KATALOG_SERWERA, "app.js");

// Wycina zawartosc obiektu zaczynajacego sie na pozycji `od` (znak "{"),
// liczac nawiasy - zagniezdzone obiekty w argumencie sa normalne, a
// wyrazenie niezachlanne konczylo dopasowanie na pierwszym "}".
function wnetrzeObiektu(tekst, od) {
  let depth = 0;

  for (let i = od; i < tekst.length; i += 1) {
    if (tekst[i] === "{") depth += 1;
    else if (tekst[i] === "}") {
      depth -= 1;

      if (depth === 0) {
        return tekst.slice(od + 1, i);
      }
    }
  }

  return null;
}

// Nazwy kluczy z listy destrukturyzacji albo z literalu obiektu.
// Pomija zagniezdzone poziomy, komentarze i wartosci domyslne.
function kluczeNajwyzszegoPoziomu(blok) {
  const klucze = new Set();

  let depth = 0;
  let biezacy = "";

  const zapisz = () => {
    const linia = biezacy
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();

    biezacy = "";

    if (!linia || linia.startsWith("...")) return;

    const nazwa = linia.split(/[:=]/)[0].trim();

    if (/^[A-Za-z_$][\w$]*$/.test(nazwa)) {
      klucze.add(nazwa);
    }
  };

  for (const znak of blok) {
    if (znak === "{" || znak === "(" || znak === "[") depth += 1;
    else if (znak === "}" || znak === ")" || znak === "]") depth -= 1;

    if (znak === "," && depth === 0) {
      zapisz();
      continue;
    }

    biezacy += znak;
  }

  zapisz();

  return klucze;
}

function wywolaniaZApp(tresc) {
  const wynik = new Map();
  const wzorzec = /(register\w+)\(\s*app\s*,\s*/g;

  let m;

  while ((m = wzorzec.exec(tresc)) !== null) {
    const nawias = tresc.indexOf("{", m.index + m[0].length - 1);

    if (nawias === -1) continue;

    const blok = wnetrzeObiektu(tresc, nawias);

    if (blok !== null) {
      wynik.set(m[1], kluczeNajwyzszegoPoziomu(blok));
    }
  }

  return wynik;
}

function definicjeModulow(katalog) {
  const wynik = new Map();

  for (const plik of fs.readdirSync(katalog).sort()) {
    if (!plik.endsWith(".js")) continue;

    const tresc = fs.readFileSync(path.join(katalog, plik), "utf8");
    const wzorzec = /export function (register\w+)\(\s*app\s*,\s*/g;

    let m;

    while ((m = wzorzec.exec(tresc)) !== null) {
      const nawias = tresc.indexOf("{", m.index + m[0].length - 1);

      if (nawias === -1) continue;

      const blok = wnetrzeObiektu(tresc, nawias);

      if (blok !== null) {
        wynik.set(m[1], { plik, oczekiwane: kluczeNajwyzszegoPoziomu(blok) });
      }
    }
  }

  return wynik;
}

// Wywolania stoja nie tylko w app.js: czesc modulow rejestruje inne moduly
// u siebie, przekazujac im zaleznosci dalej (np. routes/events.js wola
// registerGuildRoutes). Szukamy wiec wszedzie.
const zrodla = [PLIK_APP].concat(
  fs
    .readdirSync(KATALOG_TRAS)
    .filter((plik) => plik.endsWith(".js"))
    .map((plik) => path.join(KATALOG_TRAS, plik)),
);

const podane = new Map();
const gdzieWywolane = new Map();

for (const zrodlo of zrodla) {
  const tresc = fs.readFileSync(zrodlo, "utf8");

  for (const [nazwa, klucze] of wywolaniaZApp(tresc)) {
    // Eksport nie jest wywolaniem - pomijamy plik, ktory sam definiuje
    // te funkcje. Bez tego definicja modulu nadpisywala prawdziwe
    // wywolanie i narzedzie chowalo dokladnie ten blad, ktory ma znalezc.
    //
    // Zwykle porownanie tekstu, nie regeks: w szablonie sekwencja b po
    // odwrotnym ukosniku to znak backspace (0x08), a nie granica slowa,
    // wiec wzorzec nigdy sie nie dopasowywal.
    if (tresc.includes(`export function ${nazwa}(`)) continue;

    podane.set(nazwa, klucze);
    gdzieWywolane.set(nazwa, zrodlo);
  }
}
const moduly = definicjeModulow(KATALOG_TRAS);

let bledy = 0;

for (const [nazwa, { plik, oczekiwane }] of moduly) {
  const dostarczone = podane.get(nazwa);

  if (!dostarczone) {
    console.error(`  ${nazwa} (${plik}): brak wywolania w ${PLIK_APP}`);
    bledy += 1;
    continue;
  }

  const brakujace = [...oczekiwane].filter((k) => !dostarczone.has(k));
  const nadmiarowe = [...dostarczone].filter((k) => !oczekiwane.has(k));

  if (brakujace.length === 0 && nadmiarowe.length === 0) continue;

  bledy += 1;
  console.error(`  ${nazwa} (${plik}):`);

  if (brakujace.length > 0) {
    console.error(
      `      modul destrukturyzuje, app.js nie podaje: ${brakujace.join(", ")}`,
    );
  }

  if (nadmiarowe.length > 0) {
    console.error(
      `      app.js podaje, modul nie uzywa:           ${nadmiarowe.join(", ")}`,
    );
  }
}

if (bledy > 0) {
  console.error(`\n  niezgodnosci: ${bledy}`);
  process.exit(1);
}

console.log(`  zaleznosci zgodne w ${moduly.size} modulach tras`);
