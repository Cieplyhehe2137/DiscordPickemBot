// Odmiana przez liczebnik. Reguła jest prosta, ale ma wyjątek (12-14), który
// łatwo zgubić przy przepisywaniu - a kod istnieje w dwóch kopiach, bo bot
// (CJS) i front (ESM w bundlu) nie mogą dzielić jednego modułu bez kroku
// budowania. Ostatni test pilnuje, żeby te kopie się nie rozjechały.

const test = require("node:test");
const assert = require("node:assert/strict");

const bot = require("../utils/odmiana");

const P = "pojedyncza";
const M = "mnoga";
const D = "dopelniacz";

function odmienBota(n) {
  return bot.odmien(n, P, M, D);
}

test("1 to liczba pojedyncza", () => {
  assert.equal(odmienBota(1), P);
});

test("2-4 to liczba mnoga", () => {
  for (const n of [2, 3, 4]) {
    assert.equal(odmienBota(n), M, String(n));
  }
});

test("5-9 i 0 idą do dopełniacza", () => {
  for (const n of [0, 5, 6, 7, 8, 9]) {
    assert.equal(odmienBota(n), D, String(n));
  }
});

test("nastki 12-14 to dopełniacz, mimo końcówki 2-4", () => {
  for (const n of [12, 13, 14]) {
    assert.equal(odmienBota(n), D, String(n));
  }

  assert.equal(odmienBota(11), D, "11 też, bo końcówka 1 nie znaczy pojedynczej");
});

test("22-24 wracają do mnogiej, 112-114 nie", () => {
  for (const n of [22, 23, 24, 122, 1002]) {
    assert.equal(odmienBota(n), M, String(n));
  }

  for (const n of [112, 113, 114, 1013]) {
    assert.equal(odmienBota(n), D, String(n));
  }
});

test("21 i 101 to dopełniacz, nie pojedyncza", () => {
  // Tylko dokładnie 1 jest pojedyncze - "21 drużyn", nie "21 drużynę".
  for (const n of [21, 101, 1001]) {
    assert.equal(odmienBota(n), D, String(n));
  }
});

test("śmieci i wartości ujemne nie wysypują funkcji", () => {
  for (const n of [null, undefined, "", "abc", NaN, {}]) {
    assert.equal(odmienBota(n), D, `${String(n)} -> 0 -> dopełniacz`);
  }

  assert.equal(odmienBota(-1), P, "znak nie ma znaczenia");
  assert.equal(odmienBota(-3), M);
  assert.equal(odmienBota("4"), M, "liczba w stringu");
});

test("druzyny() zwraca biernik po 'wybierz'", () => {
  assert.equal(bot.druzyny(1), "drużynę");
  assert.equal(bot.druzyny(2), "drużyny");
  assert.equal(bot.druzyny(6), "drużyn");
  assert.equal(bot.druzyny(12), "drużyn");
});

test("kopia frontowa stosuje dokładnie tę samą regułę", async () => {
  const front = await import("../web/src/lib/odmiana.js");

  const rozjazdy = [];

  for (let n = 0; n <= 300; n += 1) {
    const zBota = bot.odmien(n, P, M, D);
    const zFrontu = front.odmien(n, P, M, D);

    if (zBota !== zFrontu) {
      rozjazdy.push(`${n}: bot=${zBota} front=${zFrontu}`);
    }
  }

  assert.deepEqual(rozjazdy, [], "reguła rozjechała się między kopiami");

  // druzyny() istnieje po obu stronach i musi dawać to samo słowo.
  for (const n of [1, 2, 5, 12, 22]) {
    assert.equal(bot.druzyny(n), front.druzyny(n), `druzyny(${n})`);
  }
});
