// Kontrast tekstu wzgledem tla - liczony z samych tokenow motywu.
//
// Dwie usterki, ktore ten test zamraza, wyszly dopiero z pomiaru na zywej
// stronie, a obie wygladaly w kodzie zupelnie niewinnie:
//
//  1. --text-faint w ciemnym motywie mial 3,19 na przyciemnionej kolorem
//     karcie. Na samym tle strony wychodzilo 3,90, wiec sprawdzenie "koloru
//     na tle strony" nic by nie zlapalo - wiazace jest tlo NAJJASNIEJSZE,
//     czyli karta z musnieciem akcentu.
//
//  2. --discord-text w jasnym motywie byl ustawiony na #eef2ff, czyli prawie
//     biel - przez analogie do ciemnego motywu, gdzie napis jest jasny. Tlo
//     przycisku to jednak dziesiecioprocentowe musniecie indygo, wiec napis
//     mial kontrast 1,11 i byl praktycznie niewidoczny.
//
// Dlatego test sklada warstwy tak, jak sklada je przegladarka: polprzezroczyste
// tla nakladane po kolei na tlo strony. Liczenie koloru tekstu wobec samego
// --surface-0 dawaloby wyniki, ktore nie odpowiadaja niczemu na ekranie.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const CSS = path.join(
  __dirname,
  "..",
  "web",
  "src",
  "styles",
  "design-system.css",
);

// Prog AA dla drobnego tekstu. Caly tekst, ktory tu sprawdzamy, ma 11-13 px,
// wiec luzniejszy prog 3,0 dla duzego tekstu nie ma zastosowania.
const PROG = 4.5;

function blok(tekst, selektor) {
  const start = tekst.indexOf(selektor);

  assert.notEqual(start, -1, `nie znalazlem bloku ${selektor}`);

  const od = tekst.indexOf("{", start);
  const doo = tekst.indexOf("\n}", od);

  return tekst.slice(od, doo);
}

function tokeny(tresc) {
  const mapa = new Map();

  for (const m of tresc.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    mapa.set(m[1], m[2].trim());
  }

  return mapa;
}

function kolor(wartosc) {
  const w = String(wartosc).trim();

  if (w.startsWith("#")) {
    const h = w.length === 4
      ? `#${w[1]}${w[1]}${w[2]}${w[2]}${w[3]}${w[3]}`
      : w;

    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16),
      a: 1,
    };
  }

  const m = w.match(/[\d.]+/g);

  assert.ok(m && m.length >= 3, `nie umiem odczytac koloru: ${w}`);

  return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 };
}

function nalozOne(gora, dol) {
  const a = gora.a;

  return {
    r: gora.r * a + dol.r * (1 - a),
    g: gora.g * a + dol.g * (1 - a),
    b: gora.b * a + dol.b * (1 - a),
    a: 1,
  };
}

function zloz(paleta, nazwy) {
  let tlo = null;

  for (const nazwa of nazwy) {
    const wartosc = paleta.get(nazwa);

    assert.ok(wartosc, `brak tokenu ${nazwa}`);

    const c = kolor(wartosc);

    tlo = tlo === null ? c : nalozOne(c, tlo);
  }

  return tlo;
}

function luminancja(c) {
  const f = (v) => {
    const x = v / 255;

    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function kontrast(tekst, tlo) {
  // Tekst tez sklada sie z tlem: token moze byc polprzezroczysty, a wtedy
  // liczenie go wprost daje wynik, ktorego na ekranie nie ma.
  const a = luminancja(nalozOne(tekst, tlo));
  const b = luminancja(tlo);

  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const zrodlo = fs.readFileSync(CSS, "utf8");

const CIEMNY = tokeny(blok(zrodlo, ":root {"));
const JASNY = new Map([
  ...CIEMNY,
  ...tokeny(blok(zrodlo, '[data-theme="light"] {')),
]);

// Stosy warstw, ktore faktycznie wystepuja na ekranie. Nazwa mowi, gdzie
// je zobaczyc - inaczej za rok nikt nie bedzie wiedzial, czy sa prawdziwe.
const STOSY = [
  { nazwa: "tło strony", warstwy: ["--surface-0"] },
  { nazwa: "karta", warstwy: ["--surface-0", "--layer"] },
  { nazwa: "kafelek w karcie", warstwy: ["--surface-0", "--layer", "--layer-subtle"] },
  { nazwa: "karta z akcentem", warstwy: ["--surface-0", "--layer", "--accent-bg"] },
  { nazwa: "odznaka złota", warstwy: ["--surface-0", "--layer", "--gold-bg"] },
];

const TEKSTY = ["--text", "--text-muted", "--text-faint"];

for (const [motyw, paleta] of [["ciemny", CIEMNY], ["jasny", JASNY]]) {
  for (const stos of STOSY) {
    test(`${motyw}: drabina tekstu na tle "${stos.nazwa}"`, () => {
      const tlo = zloz(paleta, stos.warstwy);

      for (const nazwa of TEKSTY) {
        const wartosc = paleta.get(nazwa);

        assert.ok(wartosc, `brak tokenu ${nazwa}`);

        const k = kontrast(kolor(wartosc), tlo);

        assert.ok(
          k >= PROG,
          `${nazwa} (${wartosc}) na "${stos.nazwa}" daje ${k.toFixed(2)}, ` +
            `prog to ${PROG}`,
        );
      }
    });
  }

  test(`${motyw}: napis na przycisku logowania`, () => {
    // Tlo przycisku to musniecie barwy marki, a nie pelne indygo. Napis
    // dobrany pod pelne indygo (jasny) znika na musnieciu w jasnym motywie.
    const tlo = zloz(paleta, ["--surface-0", "--discord-bg"]);
    const tekst = paleta.get("--discord-text");

    const k = kontrast(kolor(tekst), tlo);

    assert.ok(
      k >= PROG,
      `--discord-text (${tekst}) na tle przycisku daje ${k.toFixed(2)}`,
    );
  });
}

test("tło przycisku logowania nie wraca do color-mix", () => {
  // Narzedzie budujace rozbija color-mix() na blok @supports, ktorego
  // bezwarunkowym zapasem jest kolor PELNY - czyli nasycone indygo zamiast
  // musniecia. Test wyzej liczy z tokenu rgba i nie zobaczylby tej drugiej
  // sciezki. Ten projekt wpadl na to przy --side-a-bg i --gold-bg.
  const indexCss = fs.readFileSync(
    path.join(__dirname, "..", "web", "src", "index.css"),
    "utf8",
  );

  // Wycinanie "od .app-login do .app-logout" NIE dziala: .app-logout stoi
  // w pliku takze WYZEJ, w regule medialnej, wiec wychodzil pusty zakres
  // i test przechodzil na niczym. Stad wyszukiwanie regula po regule.
  const reguly = [
    ...indexCss.matchAll(/\.app-login[^{}]*\{([^}]*)\}/g),
  ].map((m) => m[1]);

  assert.ok(reguly.length >= 2, `znalazlem ${reguly.length} regul .app-login`);

  for (const tresc of reguly) {
    assert.equal(
      /color-mix/.test(tresc),
      false,
      "color-mix w .app-login - zapas @supports da pelne indygo pod napisem " +
        "dobranym pod muśnięcie",
    );
  }
});
