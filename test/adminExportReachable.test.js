// Pobranie arkusza z wynikami MUSI stac poza czerwona karta "Zakoncz turniej".
//
// CO BYLO. Trasa /api/events/:slug/export/classification nie pyta o stan
// turnieju - oddaje arkusz dla fazy w toku tak samo jak dla turnieju
// zamknietego, bo exportClassification przelicza punkty na wejsciu. Jedyne
// wejscie do niej w calym froncie bylo jednak golym linkiem WEWNATRZ karty
// "Zakoncz turniej": obok checkboxa, ktory usuwa dane robocze, i przycisku,
// ktory turniej konczy. Zeby pobrac wyniki w trakcie fazy, admin musial
// wejsc do jedynej karty w panelu zapowiadajacej rzeczy nieodwracalne - i
// slusznie tam nie wchodzil.
//
// CZYM TO MOZE SIE ZEPSUC. Przeniesienie linku z powrotem do karty koncowej,
// albo dolozenie go tam po raz drugi, niczego nie wywali: front sie zbuduje,
// link bedzie dzialal, a pobieranie w trakcie turnieju znowu bedzie schowane
// za ostrzezeniem o utracie danych. Zrzut ekranu tego nie pokaze, bo karta
// eksportu nadal bedzie na swoim miejscu. Dlatego ten test pilnuje MIEJSCA
// linku, nie samego jego istnienia.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PANEL = path.join(
  __dirname,
  "..",
  "web",
  "src",
  "components",
  "admin",
  "TournamentOpsPanel.jsx",
);

const source = () => fs.readFileSync(PANEL, "utf8");

/** Cialo komponentu: od jego `function` do nastepnej deklaracji w pliku. */
function componentBody(src, name) {
  const start = src.indexOf(`function ${name}(`);

  assert.notEqual(start, -1, `brak komponentu ${name}`);

  const nextDecl = src.indexOf("\nfunction ", start + 1);

  return nextDecl === -1 ? src.slice(start) : src.slice(start, nextDecl);
}

test("link do eksportu stoi w swojej karcie, nie w karcie konczacej turniej", () => {
  const src = source();
  const exportCard = componentBody(src, "ResultsExport");

  assert.ok(
    exportCard.includes("classificationExportUrl(slug)"),
    "karta eksportu nie prowadzi do trasy eksportu",
  );

  assert.ok(
    !exportCard.includes("ui-card--danger"),
    "karta eksportu podszywa sie pod karte niebezpieczna",
  );

  assert.ok(
    !componentBody(src, "ZamknijTurniej").includes("classificationExportUrl"),
    "link do eksportu wrocil do karty konczacej turniej",
  );

  // Jedno wejscie, nie dwa. Duplikat postawiony w trzecim komponencie
  // przeszedlby oba sprawdzenia powyzej.
  const occurrences = src.match(/classificationExportUrl\(/g) || [];

  assert.equal(
    occurrences.length,
    1,
    "do eksportu prowadzi wiecej niz jedno miejsce w panelu",
  );
});

test("karta eksportu stoi w panelu PRZED karta konczaca turniej", () => {
  const panel = componentBody(source(), "TournamentOpsPanel");

  const cards = [...panel.matchAll(/<([A-Z][A-Za-z]*)\s/g)].map((m) => m[1]);

  const exportIndex = cards.indexOf("ResultsExport");
  const endIndex = cards.indexOf("ZamknijTurniej");

  assert.notEqual(exportIndex, -1, "panel nie renderuje karty eksportu");
  assert.notEqual(endIndex, -1, "panel nie renderuje karty konczacej turniej");

  assert.ok(
    exportIndex < endIndex,
    `karta eksportu stoi za karta konczaca turniej: ${cards.join(", ")}`,
  );
});

test("napisy karty eksportu leza w slowniku panelu", async () => {
  const keys = [
    ...componentBody(source(), "ResultsExport").matchAll(/t\("([^"]+)"\)/g),
  ].map((m) => m[1]);

  assert.ok(
    keys.length >= 4,
    `karta eksportu uzywa ${keys.length} kluczy, spodziewane co najmniej 4`,
  );

  const { SLOWNIKI_PANELU } = await import("../web/src/i18n/index.js");

  // Tylko polski: rownosc zestawow miedzy jezykami pilnuje
  // adminDictionary.test.js, a ten test sprawdza, czy klucz istnieje
  // gdziekolwiek - bez tego na karcie staloby "admin.ops.export.title".
  const missing = keys.filter((k) => !(k in SLOWNIKI_PANELU.pl));

  assert.deepEqual(missing, [], "te napisy pokaza sie jako gole klucze");
});
