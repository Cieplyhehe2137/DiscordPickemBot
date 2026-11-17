const test = require("node:test");
const assert = require("node:assert/strict");

const {
  LIMITY,
  WIELOKROPEK,
  skroc,
  skrocPare,
} = require("../utils/discordLimits");

// Polowka pary surogatow - gdyby ciecie rozdzielilo emoji.
const ROZCIETY = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

test("skroc: tekst krotszy od limitu zostaje bez zmian", () => {
  assert.equal(skroc("100 Thieves", 45), "100 Thieves");
});

test("skroc: tekst dokladnie na limicie zostaje bez zmian", () => {
  assert.equal(skroc("ABCDE", 5), "ABCDE");
});

test("skroc: obcina biale znaki z obu stron", () => {
  assert.equal(skroc("  NAVI  ", 45), "NAVI");
});

test("skroc: dluzszy tekst miesci sie w limicie i konczy wielokropkiem", () => {
  const wynik = skroc("Chinggis Warriors", 14);

  assert.ok(wynik.length <= 14, `dlugosc ${wynik.length}`);
  assert.ok(wynik.endsWith(WIELOKROPEK));
  assert.ok(wynik.startsWith("Chinggis"));
});

test("skroc: nie zostawia spacji przed wielokropkiem", () => {
  // Limit 11 wypada na spacji po "in" - ta spacja ma zniknac, a nie zostac
  // przed wielokropkiem.
  const wynik = skroc("Ninjas in Pyjamas", 11);

  assert.equal(wynik, `Ninjas in${WIELOKROPEK}`);
  assert.ok(!wynik.includes(` ${WIELOKROPEK}`));
});

test("skroc: limit 1 oddaje sam wielokropek", () => {
  assert.equal(skroc("cokolwiek", 1), WIELOKROPEK);
});

test("skroc: limit zerowy, ujemny i niecalkowity oddaja pusty napis", () => {
  for (const limit of [0, -5, 2.5, NaN, undefined, null]) {
    assert.equal(skroc("cokolwiek", limit), "", `limit ${limit}`);
  }
});

test("skroc: brak tekstu oddaje pusty napis", () => {
  for (const tekst of [null, undefined, ""]) {
    assert.equal(skroc(tekst, 45), "");
  }
});

test("skroc: nie rozcina pary surogatow (emoji w nazwie)", () => {
  // "ABCD" + emoji (2 jednostki) + "X" = 7 jednostek, limit 6 wypada
  // dokladnie w srodku emoji.
  const wynik = skroc("ABCD\u{1F525}X", 6);

  assert.ok(!ROZCIETY.test(wynik), `polowka znaku w "${wynik}"`);
  assert.ok(wynik.length <= 6);
});

test("skrocPare: para mieszczaca sie w budzecie zostaje bez zmian", () => {
  assert.deepEqual(skrocPare("NAVI", "FaZe", 25), ["NAVI", "FaZe"]);
});

test("skrocPare: krotsza nazwa oddaje niewykorzystany budzet dluzszej", () => {
  // To jest mecz #607, ktory wywalil modal: 11 + 17 = 28 przy budzecie 25.
  const [a, b] = skrocPare("100 Thieves", "Chinggis Warriors", 25);

  assert.equal(a, "100 Thieves", "krotsza nazwa zostaje cala");
  assert.ok(a.length + b.length <= 25, `razem ${a.length + b.length}`);
  assert.ok(b.startsWith("Chinggis"));
  assert.ok(b.endsWith(WIELOKROPEK));
});

test("skrocPare: dwie dlugie nazwy dziela budzet po polowie", () => {
  const dluga = "X".repeat(60);

  const [a, b] = skrocPare(dluga, dluga, 25);

  assert.ok(a.length + b.length <= 25, `razem ${a.length + b.length}`);
  assert.ok(a.length >= 12, `pierwsza dostala tylko ${a.length}`);
  assert.ok(b.length >= 12, `druga dostala tylko ${b.length}`);
});

test("skrocPare: budzet zerowy oddaje dwa puste napisy", () => {
  assert.deepEqual(skrocPare("NAVI", "FaZe", 0), ["", ""]);
});

test("skrocPare: brak nazw nie wysypuje sie", () => {
  assert.deepEqual(skrocPare(null, undefined, 25), ["", ""]);
});

test("LIMITY zgadzaja sie z walidatorami discord.js", () => {
  // Zrodlo: @discordjs/builders - titleValidator i labelValidator to 1..45,
  // buttonLabelValidator 1..80, opcje listy 1..100.
  assert.equal(LIMITY.TYTUL_MODALA, 45);
  assert.equal(LIMITY.ETYKIETA_POLA, 45);
  assert.equal(LIMITY.ETYKIETA_PRZYCISKU, 80);
  assert.equal(LIMITY.ETYKIETA_OPCJI, 100);
});
