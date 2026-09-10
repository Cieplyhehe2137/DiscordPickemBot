// Punktacja meczów - to o te liczby ludzie się kłócą po turnieju, więc
// reguły z komentarzy w utils/matchScoring.js są tu zapisane jako asercje.
// Stałe bierzemy z rules/scoring.js, żeby test sprawdzał regułę, a nie
// przepisywał wartości - zmiana punktacji ma przechodzić, zmiana logiki nie.

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeSeriesPoints,
  computeMapPoints,
  computeTotalPoints,
  validateScore,
} = require("../utils/matchScoring");

const SCORING = require("../rules/scoring");

test("seria: trafiony zwycięzca daje punkty, pudło zero", () => {
  assert.equal(
    computeSeriesPoints({ predA: 2, predB: 0, resA: 2, resB: 1 }),
    SCORING.MATCH.WINNER,
    "zwycięzca trafiony, dokładny wynik nieistotny",
  );

  assert.equal(
    computeSeriesPoints({ predA: 2, predB: 1, resA: 0, resB: 2 }),
    0,
    "zwycięzca nietrafiony",
  );
});

test("seria: dokładny wynik nie daje nic ponad trafionego zwycięzcę", () => {
  const dokladny = computeSeriesPoints({ predA: 2, predB: 1, resA: 2, resB: 1 });
  const niedokladny = computeSeriesPoints({ predA: 2, predB: 0, resA: 2, resB: 1 });

  assert.equal(dokladny, niedokladny);
});

test("seria: brak typu albo brak wyniku to zero, nie wyjątek", () => {
  const braki = [
    { predA: null, predB: 0, resA: 2, resB: 1 },
    { predA: 2, predB: undefined, resA: 2, resB: 1 },
    { predA: 2, predB: 0, resA: "", resB: 1 },
    { predA: 2, predB: 0, resA: 2, resB: "nie liczba" },
    {},
  ];

  for (const dane of braki) {
    assert.equal(computeSeriesPoints(dane), 0, JSON.stringify(dane));
  }
});

test("seria: remis po którejkolwiek stronie nie punktuje", () => {
  assert.equal(computeSeriesPoints({ predA: 1, predB: 1, resA: 2, resB: 1 }), 0);
  assert.equal(computeSeriesPoints({ predA: 2, predB: 1, resA: 1, resB: 1 }), 0);
});

test("seria: liczby w stringach liczą się tak samo", () => {
  assert.equal(
    computeSeriesPoints({ predA: "2", predB: "0", resA: "2", resB: "1" }),
    SCORING.MATCH.WINNER,
  );
});

test("mapa: punkty maleją z odchyleniem rund", () => {
  const przypadki = [
    [{ predExactA: 13, predExactB: 11 }, SCORING.MAP.EXACT, "różnica 0"],
    [{ predExactA: 13, predExactB: 10 }, SCORING.MAP.DIFF_1, "różnica 1"],
    [{ predExactA: 13, predExactB: 9 }, SCORING.MAP.DIFF_2, "różnica 2"],
    [{ predExactA: 13, predExactB: 8 }, SCORING.MAP.MISS, "różnica 3"],
  ];

  for (const [typ, oczekiwane, opis] of przypadki) {
    assert.equal(
      computeMapPoints({ ...typ, exactA: 13, exactB: 11 }),
      oczekiwane,
      opis,
    );
  }
});

test("mapa: zły zwycięzca zeruje punkty mimo bliskiego wyniku", () => {
  // Regresja opisana w utils/matchScoring.js: typ 13:12 przy wyniku 12:13 ma
  // sumę odchyleń 2, więc bez sprawdzenia zwycięzcy dawał 1 pkt za mapę
  // wytypowaną na złą drużynę.
  assert.equal(
    computeMapPoints({
      predExactA: 13,
      predExactB: 12,
      exactA: 12,
      exactB: 13,
    }),
    SCORING.MAP.MISS,
  );
});

test("mapa: żaden zły zwycięzca nie punktuje, w całej siatce wyników", () => {
  // Własność, nie pojedynczy przypadek - to ona chroni regułę przy
  // następnym majstrowaniu przy progach.
  for (let pa = 0; pa <= 16; pa += 1) {
    for (let pb = 0; pb <= 16; pb += 1) {
      for (let ea = 0; ea <= 16; ea += 2) {
        for (let eb = 0; eb <= 16; eb += 2) {
          const typZwyciezca = pa === pb ? null : pa > pb ? "A" : "B";
          const realZwyciezca = ea === eb ? null : ea > eb ? "A" : "B";

          if (typZwyciezca === realZwyciezca) continue;

          assert.equal(
            computeMapPoints({
              predExactA: pa,
              predExactB: pb,
              exactA: ea,
              exactB: eb,
            }),
            SCORING.MAP.MISS,
            `typ ${pa}:${pb} przy wyniku ${ea}:${eb}`,
          );
        }
      }
    }
  }
});

test("mapa: brak danych to zero", () => {
  assert.equal(
    computeMapPoints({ predExactA: 13, predExactB: null, exactA: 13, exactB: 11 }),
    SCORING.MAP.MISS,
  );

  assert.equal(computeMapPoints({}), SCORING.MAP.MISS);
});

test("łącznie: suma serii i mapy", () => {
  const dane = {
    predA: 2,
    predB: 0,
    resA: 2,
    resB: 1,
    predExactA: 13,
    predExactB: 11,
    exactA: 13,
    exactB: 11,
  };

  assert.equal(
    computeTotalPoints(dane),
    computeSeriesPoints(dane) + computeMapPoints(dane),
  );

  assert.equal(computeTotalPoints(dane), SCORING.MATCH.WINNER + SCORING.MAP.EXACT);
});

test("walidacja: dozwolone wyniki dla każdego BO", () => {
  const dozwolone = {
    1: [[1, 0], [0, 1]],
    3: [[2, 0], [2, 1], [0, 2], [1, 2]],
    5: [[3, 0], [3, 1], [3, 2], [0, 3], [1, 3], [2, 3]],
  };

  for (const [bestOf, wyniki] of Object.entries(dozwolone)) {
    for (const [a, b] of wyniki) {
      assert.equal(
        validateScore({ a, b, bestOf: Number(bestOf) }).ok,
        true,
        `BO${bestOf} ${a}:${b}`,
      );
    }
  }
});

test("walidacja: wyniki niemożliwe w danym BO odpadają", () => {
  const zle = [
    [2, 0, 1],
    [3, 0, 3],
    [2, 2, 3],
    [4, 0, 5],
    [1, 0, 3],
  ];

  for (const [a, b, bestOf] of zle) {
    const wynik = validateScore({ a, b, bestOf });

    assert.equal(wynik.ok, false, `BO${bestOf} ${a}:${b} powinno odpaść`);
    assert.ok(wynik.reason, "odrzucenie musi mieć powód do pokazania");
  }
});

test("walidacja: remis, ujemne i nie-liczby mają własne komunikaty", () => {
  assert.match(validateScore({ a: 1, b: 1, bestOf: 3 }).reason, /[Rr]emis/);
  assert.match(validateScore({ a: -1, b: 2, bestOf: 3 }).reason, /ujemn/);
  assert.match(validateScore({ a: "x", b: 2, bestOf: 3 }).reason, /liczb/);
});

test("walidacja: nieobsługiwane best_of odpada zamiast przechodzić", () => {
  const wynik = validateScore({ a: 4, b: 0, bestOf: 7 });

  assert.equal(wynik.ok, false);
  assert.match(wynik.reason, /7/);
});
