// Czy kazdy kod bledu wysylany przez serwer ma zdanie w slowniku.
//
// PO CO. Caly mechanizm `code` istnieje po to, zeby komunikat bledu byl
// w jezyku strony: serwer odsyla staly identyfikator, a zdanie lezy
// w web/src/i18n (patrz web/src/lib/apiMessages.js). Gdy kodu nie ma
// w slowniku, `translateApiMessage` schodzi na POLSKIE zdanie z odpowiedzi -
// i wtedy na niemieckiej czy rosyjskiej stronie zostaje jedyny polski napis,
// akurat ten, ktory czyta sie w najgorszym momencie.
//
// NIC TEGO NIE PILNOWALO i widac to bylo w liczbach: przy pisaniu tego testu
// CZTERNASCIE kodow nie mialo tlumaczenia, a cztery klucze zostaly po
// komunikatach, ktorych nikt juz nie wysyla. Zaden test, zaden lint i zadne
// uruchomienie strony tego nie zglaszalo - bo polski zapas zawsze dziala.
//
// SPRAWDZANE SA OBA KIERUNKI:
//
//   1. kod bez zdania  -> polski napis w obcym jezyku;
//   2. zdanie bez kodu -> martwy wpis, ktory trzeba tlumaczyc przy kazdym
//      nowym jezyku.
//
// `server.*` TO DWIE RODZINY KLUCZY, i stad drugi warunek w kierunku (2):
// oprocz kodow bledow tym prefiksem nazwane sa napisy strony serwera
// (web/src/pages/ServerPage.jsx - "server.kicker", "server.stats.events").
// Klucz jest wiec uzywany, gdy wysyla go serwer ALBO gdy czyta go front.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const KORZEN = path.join(__dirname, "..");

// Narzedzia z server/tools nie odpowiadaja na zadanie - sprawdzaja trasy.
const POMIJANE = ["server/tools/"];

function pliki(katalog, rozszerzenia = [".js", ".mjs"]) {
  const wynik = [];

  for (const wpis of fs.readdirSync(katalog, { withFileTypes: true })) {
    if (wpis.name === "node_modules") continue;

    const pelna = path.join(katalog, wpis.name);

    if (wpis.isDirectory()) {
      wynik.push(...pliki(pelna, rozszerzenia));
      continue;
    }

    if (rozszerzenia.some((r) => wpis.name.endsWith(r))) wynik.push(pelna);
  }

  return wynik;
}

const WZORZEC_KODU = /["'](server\.[A-Za-z0-9_.]+)["']/g;

function zebrane(katalog, rozszerzenia) {
  const znalezione = new Map();

  for (const plik of pliki(path.join(KORZEN, katalog), rozszerzenia)) {
    const rel = path.relative(KORZEN, plik).replace(/\\/g, "/");

    if (POMIJANE.some((p) => rel.startsWith(p))) continue;

    if (rel.startsWith("web/src/i18n/")) continue;

    const tresc = fs.readFileSync(plik, "utf8");

    let m;

    while ((m = WZORZEC_KODU.exec(tresc)) !== null) {
      if (!znalezione.has(m[1])) znalezione.set(m[1], new Set());

      znalezione.get(m[1]).add(rel);
    }
  }

  return znalezione;
}

async function slownik() {
  const modul = await import("../web/src/i18n/pl.js");

  return modul.default ?? modul.pl ?? modul;
}

test("kazdy kod wysylany przez serwer ma zdanie w slowniku", async () => {
  const kody = zebrane("server");
  const klucze = new Set(Object.keys(await slownik()));

  assert.ok(kody.size > 100, `spodziewalem sie setki kodow, jest ${kody.size}`);

  const bez = [...kody.keys()]
    .filter((k) => !klucze.has(k))
    .map((k) => `${k} (${[...kody.get(k)].join(", ")})`);

  assert.deepEqual(
    bez,
    [],
    "te kody nie maja tlumaczenia - strona pokaze polskie zdanie z serwera",
  );
});

test("zaden klucz server.* nie jest martwy", async () => {
  const kody = zebrane("server");
  const front = zebrane("web/src", [".js", ".jsx"]);

  const klucze = Object.keys(await slownik()).filter((k) =>
    k.startsWith("server."),
  );

  assert.ok(klucze.length > 100, `spodziewalem sie setki kluczy, jest ${klucze.length}`);

  const martwe = klucze.filter((k) => !kody.has(k) && !front.has(k));

  assert.deepEqual(
    martwe,
    [],
    "tych kluczy nikt nie wysyla ani nie czyta - zostaly po usunietych komunikatach",
  );
});

test("kazdy jezyk ma te same kody co polski", async () => {
  // Parzystosc kluczy pilnuje test/language.test.js dla CALEGO slownika.
  // Tutaj sprawdzamy to samo wezej, bo kod bez zdania w JEDNYM jezyku to
  // dokladnie ten blad, o ktory chodzi w tym pliku - tylko trudniejszy do
  // zauwazenia.
  const kody = [...zebrane("server").keys()];

  for (const jezyk of ["en", "de", "ru", "uk"]) {
    const modul = await import(`../web/src/i18n/${jezyk}.js`);
    const obcy = modul.default ?? modul;

    const brakuje = kody.filter((k) => !(k in obcy));

    assert.deepEqual(brakuje, [], `${jezyk}: brak zdan dla tych kodow`);
  }
});

test("zdanie z klamra dostaje tresc klamry osobnym polem", async () => {
  // Klucz z {czyms} i serwer, ktory tego pola nie odsyla, dalby na ekranie
  // zdanie z widocznymi klamrami - czyli gorzej niz polski zapas. Pola
  // sa sprawdzane w tresci plikow serwera, bo skladane sa w roznych
  // miejscach (wprost w odpowiedzi albo przez `vars`).
  const pl = await slownik();
  const kody = zebrane("server");

  const trescSerwera = pliki(path.join(KORZEN, "server"))
    .filter((p) => {
      const rel = path.relative(KORZEN, p).replace(/\\/g, "/");

      return !POMIJANE.some((x) => rel.startsWith(x));
    })
    .map((p) => fs.readFileSync(p, "utf8"))
    .join("\n");

  const braki = [];

  for (const kod of kody.keys()) {
    const zdanie = pl[kod];

    if (typeof zdanie !== "string") continue;

    for (const [, nazwa] of zdanie.matchAll(/\{(\w+)\}/g)) {
      // Pole moze byc dopisane wprost (`teams: ...`) albo przez `vars`.
      const wzorzec = new RegExp(`\\b${nazwa}\\s*:`);

      if (!wzorzec.test(trescSerwera)) braki.push(`${kod} -> {${nazwa}}`);
    }
  }

  assert.deepEqual(
    braki,
    [],
    "serwer nie odsyla tresci tych klamer - zdanie wyszloby z widocznymi klamrami",
  );
});
