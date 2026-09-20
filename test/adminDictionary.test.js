// Podzial slownika: napisy panelu osobno od reszty.
//
// PO CO. Panel administratora widzi garstka ludzi, a jego napisy jechaly do
// KAZDEGO odwiedzajacego. Zmierzone przed podzialem: 336 z 1294 kluczy to
// panel, czyli 21-22% kazdego z pieciu slownikow - od 22 kB w polskim do
// 30 kB w rosyjskim i ukrainskim, surowo.
//
// CZYM TO MOZE SIE ZEPSUC. Podzial trzyma sie jednej reguly: przedrostek
// klucza decyduje, w ktorym pliku on lezy. Zlamanie jej w KAZDA strone jest
// ciche:
//
//   klucz panelu w zwyklym slowniku  -> wraca do wszystkich odwiedzajacych
//                                       i nikt tego nie zauwazy, bo strona
//                                       dziala,
//   klucz spoza panelu w pliku panelu -> jest niewidoczny na kazdej stronie
//                                       poza panelem, a tam pokaze sie goly
//                                       klucz.
//
// Zadnego z tych dwoch nie widac na zrzucie ekranu ani w tescie zestawow
// kluczy - tamten porownuje slowniki miedzy soba, a oba pliki sa w niego
// wliczone razem.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SLOWNIKI_MODUL = "../web/src/i18n/index.js";
const MODUL_JEZYKA = "../web/src/lib/language.js";

const I18N = path.join(__dirname, "..", "web", "src", "i18n");

/** Przedrostki, ktorych napisy naleza do panelu. Pierwszy czlon klucza. */
const PRZEDROSTKI_PANELU = new Set([
  "admin",
  "adminPage",
  "adminUsers",
  "adminResult",
]);

const doPanelu = (klucz) => PRZEDROSTKI_PANELU.has(klucz.split(".")[0]);

test("w pliku panelu leza WYLACZNIE klucze panelu", async () => {
  const { SLOWNIKI_PANELU } = await import(SLOWNIKI_MODUL);
  const { LANGUAGES } = await import(MODUL_JEZYKA);

  for (const kod of LANGUAGES) {
    const obce = Object.keys(SLOWNIKI_PANELU[kod]).filter((k) => !doPanelu(k));

    assert.deepEqual(
      obce,
      [],
      `${kod}.admin.js: te klucze beda niewidoczne poza panelem`,
    );
  }
});

test("w zwyklym slowniku NIE MA kluczy panelu", async () => {
  const { SLOWNIKI_PUBLICZNE } = await import(SLOWNIKI_MODUL);
  const { LANGUAGES } = await import(MODUL_JEZYKA);

  for (const kod of LANGUAGES) {
    const panelowe = Object.keys(SLOWNIKI_PUBLICZNE[kod]).filter(doPanelu);

    assert.deepEqual(
      panelowe,
      [],
      `${kod}.js: te napisy pojada do kazdego odwiedzajacego`,
    );
  }
});

test("oba pliki razem daja to samo, co przed podzialem", async () => {
  const { SLOWNIKI, SLOWNIKI_PUBLICZNE, SLOWNIKI_PANELU } = await import(SLOWNIKI_MODUL);
  const { LANGUAGES } = await import(MODUL_JEZYKA);

  for (const kod of LANGUAGES) {
    const razem =
      Object.keys(SLOWNIKI_PUBLICZNE[kod]).length +
      Object.keys(SLOWNIKI_PANELU[kod]).length;

    assert.equal(
      Object.keys(SLOWNIKI[kod]).length,
      razem,
      `${kod}: ten sam klucz stoi w obu plikach`,
    );
  }
});

test("kazdy jezyk ma plik panelu i wszystkie maja te same klucze", async () => {
  const { SLOWNIKI_PANELU } = await import(SLOWNIKI_MODUL);
  const { LANGUAGES, DOMYSLNY } = await import(MODUL_JEZYKA);

  const wzorzec = Object.keys(SLOWNIKI_PANELU[DOMYSLNY]);

  assert.ok(wzorzec.length > 0, "polski slownik panelu jest pusty");

  for (const kod of LANGUAGES) {
    assert.ok(SLOWNIKI_PANELU[kod], `brak ${kod}.admin.js`);

    const klucze = Object.keys(SLOWNIKI_PANELU[kod]);

    assert.deepEqual(
      wzorzec.filter((k) => !klucze.includes(k)),
      [],
      `${kod}.admin.js: brakuje kluczy`,
    );
  }
});

test("napisy panelu dociagane sa RAZEM ze strona panelu", () => {
  // Gdyby panel wszedl przed swoim slownikiem, przez moment stalyby na nim
  // gole klucze ("adminPage.tile.users") - zapasowy polski tez ich nie ma,
  // bo leza w tym samym dociaganym pliku.
  const app = fs.readFileSync(
    path.join(__dirname, "..", "web", "src", "App.jsx"),
    "utf8",
  );

  // Kazde `import("./pages/Admin....jsx")` w App.jsx razem z tym, co stoi
  // przed nim w tej samej instrukcji - tam ma byc zPanelem().
  const strony = [...app.matchAll(/import\("\.\/pages\/(Admin[A-Za-z]*Page)\.jsx"\)/g)];

  assert.ok(strony.length >= 2, "nie znaleziono leniwych tras panelu");

  for (const trafienie of strony) {
    const przed = app.slice(Math.max(0, trafienie.index - 80), trafienie.index);

    assert.ok(
      przed.includes("zPanelem("),
      `${trafienie[1]} wchodzi bez swojego slownika`,
    );
  }
});

test("plik panelu nie trafil do slownika publicznego przez import", () => {
  // dictionaries.js jest tym, co pobiera zwykly odwiedzajacy. Statyczny
  // import pliku panelu wciagnalby go z powrotem do glownej paczki i cala
  // oszczednosc znikla by bez sladu - liczba kluczy nadal by sie zgadzala.
  const dict = fs.readFileSync(path.join(I18N, "dictionaries.js"), "utf8");

  const statyczne = [...dict.matchAll(/^import .*?from "(.+?)";$/gm)].map(
    (m) => m[1],
  );

  assert.deepEqual(
    statyczne.filter((s) => s.includes(".admin")),
    [],
    "dictionaries.js wciaga slownik panelu na sztywno",
  );

  assert.ok(
    dict.includes('import("./pl.admin.js")'),
    "brak dociagania slownika panelu",
  );
});
