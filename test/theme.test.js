// Motyw jasny i ciemny (web/src/lib/theme.js).
//
// Testy pilnuja trzech rzeczy, ktore koncza sie strona bez zadnej pasujacej
// reguly albo strona, ktora sie nie otwiera: smiecia w zapisie przegladarki
// wpisanego wprost do atrybutu, localStorage rzucajacego wyjatkiem
// (prywatne okno, zablokowane dane witryny) i ciemnego motywu, ktory
// przestal byc domyslny.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../web/src/lib/theme.js";

// Atrapa <html>: tylko to, czego uzywa applyTheme.
function fakeRoot() {
  const atrybuty = new Map();

  return {
    atrybuty,
    setAttribute(n, v) {
      atrybuty.set(n, v);
    },
    removeAttribute(n) {
      atrybuty.delete(n);
    },
    getAttribute(n) {
      return atrybuty.has(n) ? atrybuty.get(n) : null;
    },
  };
}

function fakeStorage(poczatkowe = {}) {
  const dane = new Map(Object.entries(poczatkowe));

  return {
    dane,
    getItem: (k) => (dane.has(k) ? dane.get(k) : null),
    setItem: (k, v) => dane.set(k, v),
  };
}

// Magazyn, ktory rzuca - tak zachowuje sie localStorage w prywatnym oknie
// i przy zablokowanych danych witryny.
const magazynKtoryRzuca = {
  getItem() {
    throw new Error("dostep zabroniony");
  },
  setItem() {
    throw new Error("dostep zabroniony");
  },
};

test("ciemny jest domyslny", async () => {
  const { DOMYSLNY } = await import(MODUL);

  assert.equal(DOMYSLNY, "dark");
});

test("brak zapisu daje ciemny, a nie motyw systemu", async () => {
  // Serwis od zawsze jest ciemny i tak ma zostac dla kogos, kto nic nie
  // zmienial - takze wtedy, gdy jego system woli jasny.
  const { readTheme } = await import(MODUL);

  assert.equal(readTheme(fakeStorage()), "dark");
});

test("zapisany wybor jest odczytywany", async () => {
  const { readTheme, KLUCZ } = await import(MODUL);

  assert.equal(readTheme(fakeStorage({ [KLUCZ]: "light" })), "light");
  assert.equal(readTheme(fakeStorage({ [KLUCZ]: "dark" })), "dark");
});

test("smiec w zapisie wraca do domyslnego", async () => {
  // Zapis przezywa wdrozenia i bywa pozostaloscia po starszej wersji.
  // Wpisany wprost do atrybutu zostawilby strone bez pasujacej reguly.
  const { readTheme, normalizeTheme, KLUCZ } = await import(MODUL);

  assert.equal(readTheme(fakeStorage({ [KLUCZ]: "sepia" })), "dark");
  assert.equal(readTheme(fakeStorage({ [KLUCZ]: "" })), "dark");
  assert.equal(normalizeTheme(null), "dark");
  assert.equal(normalizeTheme(undefined), "dark");
  assert.equal(normalizeTheme(42), "dark");
});

test("magazyn rzucajacy wyjatkiem nie wywraca odczytu", async () => {
  const { readTheme } = await import(MODUL);

  assert.equal(readTheme(magazynKtoryRzuca), "dark");
  assert.equal(readTheme(null), "dark");
  assert.equal(readTheme(undefined), "dark");
});

test("magazyn rzucajacy wyjatkiem nie wywraca zapisu", async () => {
  // Motyw ma zadzialac do konca wizyty, tylko sie nie zapamieta.
  const { saveTheme } = await import(MODUL);

  assert.equal(saveTheme(magazynKtoryRzuca, "light"), false);
  assert.equal(saveTheme(null, "light"), false);
});

test("zapis odklada znormalizowana wartosc", async () => {
  const { saveTheme, KLUCZ } = await import(MODUL);

  const s = fakeStorage();

  assert.equal(saveTheme(s, "light"), true);
  assert.equal(s.dane.get(KLUCZ), "light");

  saveTheme(s, "sepia");
  assert.equal(s.dane.get(KLUCZ), "dark", "smiec zapisuje sie jako domyslny");
});

test("ciemny NIE dostaje atrybutu", async () => {
  // To jest stan domyslny, opisany w samym :root. Strona ma wygladac tak
  // samo z atrybutem "dark" i bez niego, a w HTML-u ma byc widoczne tylko
  // odstepstwo od normy.
  const { applyTheme, ATRYBUT } = await import(MODUL);

  const root = fakeRoot();

  applyTheme(root, "dark");

  assert.equal(root.getAttribute(ATRYBUT), null);
});

test("jasny dostaje atrybut", async () => {
  const { applyTheme, ATRYBUT } = await import(MODUL);

  const root = fakeRoot();

  applyTheme(root, "light");

  assert.equal(root.getAttribute(ATRYBUT), "light");
});

test("powrot do ciemnego zdejmuje atrybut", async () => {
  // Zostawiony atrybut "light" przy ciemnym motywie to strona jasna mimo
  // wyboru - i nic w kodzie by na to nie wskazywalo.
  const { applyTheme, ATRYBUT } = await import(MODUL);

  const root = fakeRoot();

  applyTheme(root, "light");
  applyTheme(root, "dark");

  assert.equal(root.getAttribute(ATRYBUT), null);
});

test("smiec nie trafia do atrybutu", async () => {
  const { applyTheme, ATRYBUT } = await import(MODUL);

  const root = fakeRoot();

  applyTheme(root, "sepia");

  assert.equal(root.getAttribute(ATRYBUT), null, "wraca do domyslnego");
});

test("applyTheme oddaje motyw, ktory faktycznie ustawil", async () => {
  const { applyTheme } = await import(MODUL);

  assert.equal(applyTheme(fakeRoot(), "light"), "light");
  assert.equal(applyTheme(fakeRoot(), "sepia"), "dark");
  assert.equal(applyTheme(null, "light"), "dark", "brak dokumentu nie wywraca");
});

test("przelacznik prowadzi tam i z powrotem", async () => {
  const { otherTheme } = await import(MODUL);

  assert.equal(otherTheme("dark"), "light");
  assert.equal(otherTheme("light"), "dark");
  assert.equal(otherTheme("sepia"), "light", "smiec traktowany jak ciemny");
});

test("klucz zapisu zgadza sie z tym w index.html", async () => {
  // Wbudowany skrypt w index.html czyta ten sam klucz PRZED pierwszym
  // malowaniem. Gdyby sie rozjechaly, strona mrugalaby ciemnym motywem
  // przed przelaczeniem na jasny - i nic by tego nie zglosilo.
  const fs = require("node:fs");
  const path = require("node:path");

  const { KLUCZ, ATRYBUT } = await import(MODUL);

  const html = fs.readFileSync(
    path.join(__dirname, "..", "web", "index.html"),
    "utf8",
  );

  assert.ok(
    html.includes(KLUCZ),
    `index.html nie czyta klucza "${KLUCZ}" - motyw bedzie mrugal przy wejsciu`,
  );

  assert.ok(
    html.includes(ATRYBUT),
    `index.html nie ustawia atrybutu "${ATRYBUT}"`,
  );
});
