// Odznaki gracza (web/src/lib/badges.js).
//
// Dwa rodzaje testow. Pierwszy pilnuje logiki: zeby odznaka nie przyznawala
// sie za zle, nie pokazywala trzech poziomow tej samej rzeczy naraz i zeby
// miejsce w rankingu liczylo sie odwrotnie niz reszta.
//
// Drugi pilnuje PROGOW, bo one sa tu wlasciwa trescia. Sa zmierzone na
// trzydziestu najlepszych graczach turnieju z 262 uczestnikami i najgorszy
// blad, jaki mozna tu zrobic, to prog nieosiagalny: odznaka, ktorej nikt
// nigdy nie dostanie, jest gorsza niz jej brak, bo wyglada na osiagalna.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../web/src/lib/badges.js";

// Zmierzone maksima w czolowce - zaden prog nie moze ich przekraczac.
const ZMIERZONE_MAKSIMA = {
  accuracy: 68,
  exact_series: 22,
  exact_maps: 12,
  best_correct_streak: 10,
  perfect_matches: 1,
  best_match_points: 10,
};

function gracz(nadpisania = {}) {
  return {
    accuracy: 0,
    best_correct_streak: 0,
    exact_series: 0,
    exact_maps: 0,
    total_points: 0,
    perfect_matches: 0,
    best_match_points: 0,
    finished_predictions: 0,
    rank: null,
    ...nadpisania,
  };
}

function klucze(lista) {
  return lista.map((b) => b.key);
}

test("gracz bez dorobku nie dostaje zadnej odznaki", async () => {
  const { awardBadges } = await import(MODUL);

  const { earned } = awardBadges(gracz());

  assert.deepEqual(earned, []);
});

test("brak profilu nie wywraca sie, tylko daje pustke", async () => {
  const { awardBadges } = await import(MODUL);

  assert.deepEqual(awardBadges(null), { earned: [], next: [] });
  assert.deepEqual(awardBadges(undefined).earned, []);
});

test("pokazywany jest tylko NAJWYZSZY zdobyty poziom rodziny", async () => {
  // Gracz z 65% skutecznosci spelnia takze progi 50 i 60. Trzy kafelki
  // mowiace to samo to nie trzy osiagniecia.
  const { awardBadges } = await import(MODUL);

  const { earned } = awardBadges(gracz({ accuracy: 65 }));

  const zRodziny = earned.filter((b) => b.key.startsWith("accuracy-"));

  assert.equal(zRodziny.length, 1);
  assert.equal(zRodziny[0].key, "accuracy-3");
});

test("prog na styk liczy sie jako zdobyty", async () => {
  const { awardBadges } = await import(MODUL);

  assert.ok(klucze(awardBadges(gracz({ accuracy: 50 })).earned).includes("accuracy-1"));
  assert.ok(!klucze(awardBadges(gracz({ accuracy: 49 })).earned).includes("accuracy-1"));
});

test("miejsce w rankingu liczy sie odwrotnie niz reszta", async () => {
  // Wszedzie wiecej znaczy lepiej, tu mniej. Bez tego podium dostawalby
  // gracz z miejsca 250, a nie z trzeciego.
  const { awardBadges } = await import(MODUL);

  assert.ok(klucze(awardBadges(gracz({ rank: 1 })).earned).includes("podium"));
  assert.ok(klucze(awardBadges(gracz({ rank: 3 })).earned).includes("podium"));
  assert.ok(!klucze(awardBadges(gracz({ rank: 4 })).earned).includes("podium"));
  assert.ok(!klucze(awardBadges(gracz({ rank: 250 })).earned).includes("podium"));
});

test("brak miejsca w rankingu to nie podium", async () => {
  // rank bywa nullem dla niesklasyfikowanych. Number(null) to zero, czyli
  // miejsce lepsze niz pierwsze - bez jawnego sprawdzenia kazdy
  // niesklasyfikowany gracz dostawalby zlota odznake.
  const { awardBadges } = await import(MODUL);

  assert.ok(!klucze(awardBadges(gracz({ rank: null })).earned).includes("podium"));
});

test("postep do nastepnej odznaki jest procentem drogi", async () => {
  const { awardBadges } = await import(MODUL);

  const { next } = awardBadges(gracz({ exact_maps: 2 }));

  const mapy = next.find((b) => b.key === "exact_maps-1");

  assert.ok(mapy, "nastepna odznaka z tej rodziny ma byc na liscie");
  assert.equal(mapy.target, 3);
  assert.equal(mapy.percent, 67);
});

test("miejsce w rankingu nie ma paska postepu", async () => {
  // "Polowa drogi do trzeciego miejsca" nic nie znaczy.
  const { awardBadges } = await import(MODUL);

  const { next } = awardBadges(gracz({ rank: 40 }));

  assert.ok(!klucze(next).includes("podium"));
});

test("na liscie do zdobycia stoja najblizsze, nie najtrudniejsze", async () => {
  const { awardBadges } = await import(MODUL);

  const { next } = awardBadges(
    gracz({ accuracy: 49, exact_maps: 0, total_points: 0 }),
  );

  assert.ok(next.length > 0);

  // Posortowane malejaco po procencie drogi.
  for (let i = 1; i < next.length; i++) {
    assert.ok(
      next[i - 1].percent >= next[i].percent,
      "lista ma isc od najblizszych",
    );
  }

  assert.equal(next[0].key, "accuracy-1", "98% drogi do pierwszego progu");
});

test("zdobyte ida od najwyzszego poziomu", async () => {
  const { awardBadges } = await import(MODUL);

  const { earned } = awardBadges(
    gracz({ accuracy: 50, perfect_matches: 1, finished_predictions: 30 }),
  );

  for (let i = 1; i < earned.length; i++) {
    assert.ok(earned[i - 1].tier >= earned[i].tier);
  }

  assert.equal(earned[0].key, "perfect", "zlota na gorze");
});

test("ZADEN prog nie przekracza tego, co ktokolwiek osiagnal", async () => {
  // Najgorszy mozliwy blad w tej liscie: odznaka nieosiagalna. Prog 75%
  // skutecznosci wygladalby rozsadnie, a nikt w czolowce nie przekroczyl 68%.
  const { awardBadges } = await import(MODUL);

  // Gracz o zmierzonych maksimach musi zdobyc WSZYSTKO, co od nich zalezy.
  const najlepszy = gracz({ ...ZMIERZONE_MAKSIMA, rank: 1, finished_predictions: 50 });

  const { earned } = awardBadges(najlepszy);

  const zdobyte = klucze(earned);

  for (const oczekiwana of [
    "accuracy-3",
    "streak-3",
    "exact_series-3",
    "exact_maps-3",
    "perfect",
    "big-match",
    "podium",
    "regular",
  ]) {
    assert.ok(
      zdobyte.includes(oczekiwana),
      `prog odznaki "${oczekiwana}" jest wyzszy niz cokolwiek, co zmierzono - nikt jej nie dostanie`,
    );
  }
});

test("mediana czolowki dostaje kilka odznak, ale nie wszystkie", async () => {
  // Odznaka, ktora ma kazdy, nie jest odznaka. Odznaka, ktorej nie ma nikt,
  // tez nie. Mediana czolowki ma trafiac gdzies posrodku.
  const { awardBadges } = await import(MODUL);

  const medianaCzolowki = gracz({
    accuracy: 59,
    exact_series: 15,
    exact_maps: 7,
    best_correct_streak: 6,
    perfect_matches: 0,
    best_match_points: 7,
    total_points: 123,
    finished_predictions: 48,
    rank: 15,
  });

  const { earned, next } = awardBadges(medianaCzolowki);

  assert.ok(earned.length >= 4, `mediana czolowki ma miec kilka odznak, ma ${earned.length}`);
  assert.ok(earned.length <= 7, `nie moze miec kompletu, ma ${earned.length}`);

  // I ma widziec, co jest w zasiegu.
  assert.ok(next.length > 0);
});

test("zloty poziom skutecznosci jest osiagalny, ale rzadki", async () => {
  // 65% - gorne 10% czolowki. 68% to maksimum, jakie zmierzono.
  const { awardBadges } = await import(MODUL);

  assert.ok(klucze(awardBadges(gracz({ accuracy: 68 })).earned).includes("accuracy-3"));
  assert.ok(klucze(awardBadges(gracz({ accuracy: 65 })).earned).includes("accuracy-3"));
  assert.ok(!klucze(awardBadges(gracz({ accuracy: 62 })).earned).includes("accuracy-3"));
});

test("kazda odznaka ma ikone, nazwe i opis", async () => {
  const { awardBadges } = await import(MODUL);

  const najlepszy = gracz({ ...ZMIERZONE_MAKSIMA, rank: 1, finished_predictions: 50, total_points: 156 });

  for (const b of awardBadges(najlepszy).earned) {
    assert.ok(b.icon, `${b.key} bez ikony`);
    assert.ok(b.label, `${b.key} bez nazwy`);
    assert.ok(b.desc, `${b.key} bez opisu`);
    assert.ok([1, 2, 3].includes(b.tier), `${b.key} ma dziwny poziom`);
  }
});

test("kazdy poziom ma swoja klase CSS", async () => {
  // Klasy podane wprost, nie sklejane - inaczej narzedzie do usuwania
  // martwego CSS kasuje je jako nieuzywane.
  const { POZIOM_KLASA } = await import(MODUL);

  for (const tier of [1, 2, 3]) {
    assert.ok(POZIOM_KLASA[tier], `brak klasy dla poziomu ${tier}`);
  }
});
