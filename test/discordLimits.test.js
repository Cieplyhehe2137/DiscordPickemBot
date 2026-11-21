const test = require("node:test");
const assert = require("node:assert/strict");

const {
  LIMITS,
  ELLIPSIS,
  truncate,
  truncatePair,
} = require("../utils/discordLimits");

// Polowka pary surogatow - gdyby ciecie rozdzielilo emoji.
const ROZCIETY = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

test("truncate: tekst krotszy od limitu zostaje bez zmian", () => {
  assert.equal(truncate("100 Thieves", 45), "100 Thieves");
});

test("truncate: tekst dokladnie na limicie zostaje bez zmian", () => {
  assert.equal(truncate("ABCDE", 5), "ABCDE");
});

test("truncate: obcina biale znaki z obu stron", () => {
  assert.equal(truncate("  NAVI  ", 45), "NAVI");
});

test("truncate: dluzszy tekst miesci sie w limicie i konczy wielokropkiem", () => {
  const wynik = truncate("Chinggis Warriors", 14);

  assert.ok(wynik.length <= 14, `dlugosc ${wynik.length}`);
  assert.ok(wynik.endsWith(ELLIPSIS));
  assert.ok(wynik.startsWith("Chinggis"));
});

test("truncate: nie zostawia spacji przed wielokropkiem", () => {
  // Limit 11 wypada na spacji po "in" - ta spacja ma zniknac, a nie zostac
  // przed wielokropkiem.
  const wynik = truncate("Ninjas in Pyjamas", 11);

  assert.equal(wynik, `Ninjas in${ELLIPSIS}`);
  assert.ok(!wynik.includes(` ${ELLIPSIS}`));
});

test("truncate: limit 1 oddaje sam wielokropek", () => {
  assert.equal(truncate("cokolwiek", 1), ELLIPSIS);
});

test("truncate: limit zerowy, ujemny i niecalkowity oddaja pusty napis", () => {
  for (const limit of [0, -5, 2.5, NaN, undefined, null]) {
    assert.equal(truncate("cokolwiek", limit), "", `limit ${limit}`);
  }
});

test("truncate: brak tekstu oddaje pusty napis", () => {
  for (const tekst of [null, undefined, ""]) {
    assert.equal(truncate(tekst, 45), "");
  }
});

test("truncate: nie rozcina pary surogatow (emoji w nazwie)", () => {
  // "ABCD" + emoji (2 jednostki) + "X" = 7 jednostek, limit 6 wypada
  // dokladnie w srodku emoji.
  const wynik = truncate("ABCD\u{1F525}X", 6);

  assert.ok(!ROZCIETY.test(wynik), `polowka znaku w "${wynik}"`);
  assert.ok(wynik.length <= 6);
});

test("truncatePair: para mieszczaca sie w budzecie zostaje bez zmian", () => {
  assert.deepEqual(truncatePair("NAVI", "FaZe", 25), ["NAVI", "FaZe"]);
});

test("truncatePair: krotsza nazwa oddaje niewykorzystany budzet dluzszej", () => {
  // To jest mecz #607, ktory wywalil modal: 11 + 17 = 28 przy budzecie 25.
  const [a, b] = truncatePair("100 Thieves", "Chinggis Warriors", 25);

  assert.equal(a, "100 Thieves", "krotsza nazwa zostaje cala");
  assert.ok(a.length + b.length <= 25, `razem ${a.length + b.length}`);
  assert.ok(b.startsWith("Chinggis"));
  assert.ok(b.endsWith(ELLIPSIS));
});

test("truncatePair: dwie dlugie nazwy dziela budzet po polowie", () => {
  const dluga = "X".repeat(60);

  const [a, b] = truncatePair(dluga, dluga, 25);

  assert.ok(a.length + b.length <= 25, `razem ${a.length + b.length}`);
  assert.ok(a.length >= 12, `pierwsza dostala tylko ${a.length}`);
  assert.ok(b.length >= 12, `druga dostala tylko ${b.length}`);
});

test("truncatePair: budzet zerowy oddaje dwa puste napisy", () => {
  assert.deepEqual(truncatePair("NAVI", "FaZe", 0), ["", ""]);
});

test("truncatePair: brak nazw nie wysypuje sie", () => {
  assert.deepEqual(truncatePair(null, undefined, 25), ["", ""]);
});

test("LIMITS zgadzaja sie z walidatorami discord.js", () => {
  // Zrodlo: @discordjs/builders - titleValidator i labelValidator to 1..45,
  // buttonLabelValidator 1..80, opcje listy 1..100.
  assert.equal(LIMITS.MODAL_TITLE, 45);
  assert.equal(LIMITS.FIELD_LABEL, 45);
  assert.equal(LIMITS.BUTTON_LABEL, 80);
  assert.equal(LIMITS.OPTION_LABEL, 100);

  // Embed: descriptionPredicate to 1..4096, fieldValuePredicate do 1024,
  // fieldNamePredicate do 256.
  assert.equal(LIMITS.EMBED_DESCRIPTION, 4096);
  assert.equal(LIMITS.EMBED_FIELD_VALUE, 1024);
  assert.equal(LIMITS.EMBED_FIELD_NAME, 256);
  assert.equal(LIMITS.EMBED_TITLE, 256);
});
