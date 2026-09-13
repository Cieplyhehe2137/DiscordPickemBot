// Kazde wolanie API z frontu musi przejsc przez apiRequest.
//
// Dwie funkcje - getMyEventPredictions i getMyStats - mialy wlasny
// `fetch("/api/...")` z gola sciezka. Przy jednym origin to dzialalo. Odkad
// front stoi na Cloudflare Pages, a API pod osobna domena, taka sciezka
// rozwiazuje sie wzgledem FRONTU, a tam regula z web/public/_redirects
// (`/*  /index.html  200`) oddaje index.html na kazda nieznana sciezke.
//
// Objaw byl myloacy i nie wskazywal na adres: "SyntaxError: unexpected
// character at line 1 column 1 of the JSON data" - bo `<` z <!doctype html>
// nie jest JSON-em. Strona "Moje typy" i "Moje statystyki" nie dzialaly
// w ogole, a nic w kodzie nie wygladalo na zepsute.
//
// Test czyta ZRODLO jako tekst: api.js uzywa import.meta.env, ktorego nie da
// sie zaimportowac poza Vite, a i tak sprawdzana jest tu zasada zapisu,
// a nie zachowanie w czasie dzialania.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const API_JS = path.join(__dirname, "..", "web", "src", "lib", "api.js");

function zrodlo() {
  return fs.readFileSync(API_JS, "utf8");
}

// Komentarze odpadaja - opisuja blad, wiec zawieraja jego przyklad.
function bezKomentarzy(tekst) {
  return tekst
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((linia) => !linia.trim().startsWith("//"))
    .join("\n");
}

test("zaden fetch nie idzie na gola sciezke /api", async () => {
  const kod = bezKomentarzy(zrodlo());

  const gole = [...kod.matchAll(/fetch\(\s*[`"']\/api\b/g)];

  assert.deepEqual(
    gole.map((m) => m[0]),
    [],
    'sciezka "/api/..." rozwiaze sie wzgledem frontu, nie API - uzyj apiRequest',
  );
});

test("jest dokladnie jedno miejsce, ktore wola fetch", async () => {
  const kod = bezKomentarzy(zrodlo());

  const wywolania = [...kod.matchAll(/\bfetch\(/g)];

  assert.equal(
    wywolania.length,
    1,
    "kazde wolanie API ma isc przez apiRequest - drugi fetch to druga droga, " +
      "na ktorej ta sama pomylka moze wrocic",
  );
});

test("apiRequest sklada adres z bazy, a nie ze sciezki wzglednej", async () => {
  const kod = zrodlo();

  assert.match(
    kod,
    /const API_BASE_URL = .*import\.meta\.env\.VITE_API_URL/,
    "baza adresu musi brac sie z VITE_API_URL",
  );
  assert.match(
    kod,
    /fetch\(\s*`\$\{API_BASE_URL\}\$\{path\}`/,
    "fetch ma sklejac baze ze sciezka",
  );
});

test("publiczne trasy podaje sie bez przedrostka /api", async () => {
  // API_BASE_URL konczy sie na "/api", wiec sciezka zaczynajaca sie od "/api"
  // dalaby ".../api/api/...". Tego nie widac przy czytaniu jednej linijki.
  const kod = bezKomentarzy(zrodlo());

  const zlePrzedrostki = [...kod.matchAll(/apiRequest\(\s*[`"']\/api\//g)];

  assert.deepEqual(
    zlePrzedrostki.map((m) => m[0]),
    [],
    "apiRequest dostaje sciezke BEZ /api - baza juz je zawiera",
  );
});
