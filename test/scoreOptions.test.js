// Opcje wyniku serii w dropdownie bota.
//
// Jedna rzecz moze tu zepsuc caly turniej po cichu: `value` idzie prosto do
// match_predictions jako pred_a:pred_b. Etykieta jest dla czlowieka,
// wartosc dla punktacji - i odwrocenie tej drugiej zamienia kazdy typ na
// druga druzyne w typ na pierwsza. Wyszloby dopiero przy rozliczeniu.
//
// Zgloszenie z 2026-11-27: lista pokazywala "0-2 Heroic", czyli liczby
// z perspektywy PIERWSZEJ druzyny i nazwe DRUGIEJ. Czyta sie to jak
// porazke Heroic, a znaczy jej zwyciestwo. Strona robila to poprawnie
// (web/src/pages/MatchPage.jsx), wiec bot byl jedynym miejscem z tym
// zapisem.

const test = require("node:test");
const assert = require("node:assert/strict");

const { scoreOptionsForBo } = require("../utils/scoreOptions");

const A = "Lynn Vision";
const B = "Heroic";

/* ===============================
   ETYKIETY
   =============================== */

test("BO3: kazda etykieta liczy od zwyciezcy", () => {
  const opcje = scoreOptionsForBo(3, A, B);

  assert.deepEqual(
    opcje.map((o) => o.label),
    [
      "2-0 Lynn Vision",
      "2-1 Lynn Vision",
      "2-0 Heroic",
      "2-1 Heroic",
    ],
  );
});

test("BO3: zadna etykieta nie zaczyna sie od zera", () => {
  // "0-2 Heroic" bylo tresci zgloszenia - liczby czytane od przegranego.
  for (const o of scoreOptionsForBo(3, A, B)) {
    assert.ok(
      !/^0-/.test(o.label),
      `etykieta liczy od przegranego: ${o.label}`,
    );
  }
});

test("BO1 i BO5 trzymaja te sama zasade", () => {
  assert.deepEqual(
    scoreOptionsForBo(1, A, B).map((o) => o.label),
    ["1-0 Lynn Vision", "1-0 Heroic"],
  );

  assert.deepEqual(
    scoreOptionsForBo(5, A, B).map((o) => o.label),
    [
      "3-0 Lynn Vision",
      "3-1 Lynn Vision",
      "3-2 Lynn Vision",
      "3-0 Heroic",
      "3-1 Heroic",
      "3-2 Heroic",
    ],
  );
});

/* ===============================
   WARTOSCI - TU NIC NIE WOLNO ZMIENIC
   =============================== */

test("value zostaje w formacie A:B, czyli tak jak w bazie", () => {
  assert.deepEqual(
    scoreOptionsForBo(3, A, B).map((o) => o.value),
    ["2:0", "2:1", "0:2", "1:2"],
  );

  assert.deepEqual(
    scoreOptionsForBo(1, A, B).map((o) => o.value),
    ["1:0", "0:1"],
  );

  assert.deepEqual(
    scoreOptionsForBo(5, A, B).map((o) => o.value),
    ["3:0", "3:1", "3:2", "0:3", "1:3", "2:3"],
  );
});

test("etykieta i wartosc wskazuja TEGO SAMEGO zwyciezce", () => {
  // Najwazniejszy test w tym pliku: gdyby odwrocic value zamiast etykiety,
  // wszystkie typy na druga druzyne zapisalyby sie jako typy na pierwsza.
  for (const bo of [1, 3, 5]) {
    for (const o of scoreOptionsForBo(bo, A, B)) {
      const [a, b] = o.value.split(":").map(Number);

      const zWartosci = a > b ? A : B;
      const zEtykiety = o.label.endsWith(A) ? A : B;

      assert.equal(
        zEtykiety,
        zWartosci,
        `BO${bo}: etykieta "${o.label}" nie zgadza sie z wartoscia "${o.value}"`,
      );
    }
  }
});

test("liczby w etykiecie to te same liczby, co w wartosci", () => {
  for (const bo of [1, 3, 5]) {
    for (const o of scoreOptionsForBo(bo, A, B)) {
      const zEtykiety = o.label.match(/^(\d+)-(\d+)/).slice(1).map(Number);
      const zWartosci = o.value.split(":").map(Number);

      assert.deepEqual(
        [...zEtykiety].sort(),
        [...zWartosci].sort(),
        `BO${bo}: "${o.label}" kontra "${o.value}"`,
      );
    }
  }
});

test("wygrana zawsze oznacza komplet map do wygranej serii", () => {
  for (const [bo, doWygranej] of [[1, 1], [3, 2], [5, 3]]) {
    for (const o of scoreOptionsForBo(bo, A, B)) {
      const [a, b] = o.value.split(":").map(Number);

      assert.equal(
        Math.max(a, b),
        doWygranej,
        `BO${bo}: ${o.value} nie konczy serii`,
      );

      assert.ok(Math.min(a, b) < doWygranej, `BO${bo}: ${o.value} to remis`);
    }
  }
});

/* ===============================
   SKRAJNOSCI
   =============================== */

test("nieznany format serii oddaje pusta liste", () => {
  for (const bo of [0, 2, 4, 7, null, undefined, "abc"]) {
    assert.deepEqual(scoreOptionsForBo(bo, A, B), [], `BO=${bo}`);
  }
});

test("brak nazw druzyn nie zostawia pustego miejsca", () => {
  const opcje = scoreOptionsForBo(3);

  assert.deepEqual(
    opcje.map((o) => o.label),
    ["2-0 Team A", "2-1 Team A", "2-0 Team B", "2-1 Team B"],
  );
});

test("opcje sa niepowtarzalne", () => {
  for (const bo of [1, 3, 5]) {
    const opcje = scoreOptionsForBo(bo, A, B);

    assert.equal(
      new Set(opcje.map((o) => o.value)).size,
      opcje.length,
      `BO${bo}: powtorzona wartosc`,
    );

    assert.equal(
      new Set(opcje.map((o) => o.label)).size,
      opcje.length,
      `BO${bo}: powtorzona etykieta`,
    );
  }
});

test("etykieta miesci sie w limicie opcji Discorda", () => {
  // StringSelectMenuOption.label to 1..100 znakow, a nazwy druzyn
  // wpisuje czlowiek.
  const dluga = "X".repeat(60);

  for (const o of scoreOptionsForBo(5, dluga, dluga)) {
    assert.ok(o.label.length <= 100, `${o.label.length} znakow`);
  }
});
