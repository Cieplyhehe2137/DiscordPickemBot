// Podpis pod nazwa gracza w rankingu (web/src/lib/pickSummary.js).
//
// CO SIE STALO. Podpis liczyl WYLACZNIE typy meczowe, a klasyfikacja turnieju
// sklada sie z szesciu skladowych, z czego piec to fazy. Kto wytypowal cala
// drabinke playoffs i ani jednego meczu, czytal o sobie "0 z 37 typow".
// Zmierzone na produkcji: w epl-season24 osmioro z dziewieciu graczy
// dopisanych do klasyfikacji ma dokladnie taki wiersz.
//
// Drugi przypadek jest wiekszy. StarLadder Budapest to turniej z samych faz:
// 509 graczy, 1055 oddanych typow, zero meczow - a podpis znikal tam
// CALKOWICIE, bo warunek chowal go przy zerze meczow.
//
// Liczby ZOSTAJA ROZDZIELONE i ten plik tego pilnuje: total_predictions jest
// mianownikiem skutecznosci i bramka progu w lib/accuracyRanking.js.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../web/src/lib/pickSummary.js";

// Tlumacz-atrapa: oddaje klucz i zapamietuje, z jakimi liczbami go zawolano.
// Chodzi nie tylko o to, KTORE czlony wychodza, ale tez jakie liczby w nich
// stoja - tam zginelyby typy faz, gdyby ktos je kiedys dolal do `done`.
function fakeT() {
  const wywolania = [];

  const t = (klucz, zmienne) => {
    wywolania.push({ klucz, zmienne: zmienne || {} });

    return klucz;
  };

  t.wywolania = wywolania;

  t.zmienneDla = (klucz) =>
    wywolania.find((w) => w.klucz === klucz)?.zmienne ?? null;

  return t;
}

test("typy meczowe i typy faz stoja w jednym podpisie", async () => {
  const { buildPickSummary } = await import(MODUL);

  const t = fakeT();

  const czlony = buildPickSummary({
    player: { total_predictions: 3, phase_predictions: 2, accuracy: 67 },
    matches: 37,
    t,
  });

  assert.deepEqual(czlony, ["leaderboard.picksHit", "leaderboard.phasePicks"]);
});

test("TURNIEJ Z SAMYCH FAZ dostaje podpis, a nie pustke", async () => {
  // StarLadder Budapest: zero meczow, 509 graczy, 1055 oddanych typow.
  // Wczesniej kazdy z nich mial tu puste miejsce.
  const { buildPickSummary } = await import(MODUL);

  const t = fakeT();

  const czlony = buildPickSummary({
    player: { total_predictions: 0, phase_predictions: 3 },
    matches: 0,
    t,
  });

  assert.deepEqual(czlony, ["leaderboard.phasePicks"]);
  assert.equal(t.zmienneDla("leaderboard.phasePicks").count, 3);
});

test("bez meczow i bez faz nie ma podpisu wcale", async () => {
  // Pusta tablica, a nie pusty napis: wolajacy ma wtedy nie rysowac
  // elementu, bo pusty <span> zostawia w wierszu dziure.
  const { buildPickSummary } = await import(MODUL);

  assert.deepEqual(
    buildPickSummary({
      player: { total_predictions: 0, phase_predictions: 0 },
      matches: 0,
      t: fakeT(),
    }),
    [],
  );
});

test("zero typow meczowych przy meczach nadal cos mowi", async () => {
  // "0 z 37 typow" to informacja - ktos pominal mecze - wiec zostaje,
  // a typy faz dochodza obok.
  const { buildPickSummary } = await import(MODUL);

  const t = fakeT();

  const czlony = buildPickSummary({
    player: { total_predictions: 0, phase_predictions: 1 },
    matches: 37,
    t,
  });

  assert.deepEqual(czlony, ["leaderboard.picks", "leaderboard.phasePicks"]);
  assert.equal(t.zmienneDla("leaderboard.picks").done, 0);
});

test("TYPY FAZ NIE WCHODZA do licznika typow meczowych", async () => {
  // To jest cala ostroznosc tej zmiany. Wspolny licznik zanizylby odsetek
  // trafien kazdemu, kto typowal fazy, i pozwalalby wejsc do stawki
  // skutecznosci bez typowania meczow.
  const { buildPickSummary } = await import(MODUL);

  const t = fakeT();

  buildPickSummary({
    player: { total_predictions: 4, phase_predictions: 3, accuracy: 50 },
    matches: 20,
    t,
  });

  const mecze = t.zmienneDla("leaderboard.picksHit");

  assert.equal(mecze.done, 4, "licznik to typy meczowe, bez faz");
  assert.equal(mecze.all, 20, "mianownik to mecze, bez faz");
  assert.equal(mecze.percent, 50, "odsetek przychodzi gotowy z serwera");

  assert.equal(
    t.zmienneDla("leaderboard.phasePicks").count,
    3,
    "fazy licza sie osobno",
  );
});

test("widok skutecznosci nie powtarza odsetka, ale pokazuje fazy", async () => {
  // W tej tabeli odsetek stoi w kolumnie obok, wiec w podpisie idzie
  // miejsce punktowe - i to ONO ma byc na koncu, bo jest odnosnikiem do
  // drugiego widoku, a nie czescia wyniku.
  const { buildPickSummary } = await import(MODUL);

  const t = fakeT();

  const czlony = buildPickSummary({
    player: {
      total_predictions: 30,
      phase_predictions: 2,
      accuracy: 70,
      points_rank: 45,
    },
    matches: 50,
    byAccuracy: true,
    t,
  });

  assert.deepEqual(czlony, [
    "leaderboard.picks",
    "leaderboard.phasePicks",
    "leaderboard.pointsRank",
  ]);

  assert.equal(
    t.wywolania.some((w) => w.klucz === "leaderboard.picksHit"),
    false,
    "odsetek nie moze sie powtarzac",
  );
});

test("brak miejsca punktowego nie zostawia wiszacego separatora", async () => {
  const { buildPickSummary, formatPickSummary } = await import(MODUL);

  const bez = {
    player: { total_predictions: 30, phase_predictions: 0, points_rank: null },
    matches: 50,
    byAccuracy: true,
    t: fakeT(),
  };

  assert.deepEqual(buildPickSummary(bez), ["leaderboard.picks"]);
  assert.equal(formatPickSummary(bez), "leaderboard.picks");
});

test("smiec w wierszu nie wysypuje podpisu", async () => {
  // Wiersze dolaczane przez NOT EXISTS nie maja czesci kolumn, wiec
  // undefined jest tu normalnym wejsciem, a nie bledem.
  const { buildPickSummary } = await import(MODUL);

  assert.deepEqual(buildPickSummary(), []);
  assert.deepEqual(buildPickSummary({ t: fakeT() }), []);

  assert.deepEqual(
    buildPickSummary({
      player: { total_predictions: null, phase_predictions: "2" },
      matches: "10",
      t: fakeT(),
    }),
    ["leaderboard.picks", "leaderboard.phasePicks"],
  );
});

test("czlony sklejaja sie separatorem tabeli", async () => {
  const { formatPickSummary } = await import(MODUL);

  assert.equal(
    formatPickSummary({
      player: { total_predictions: 3, phase_predictions: 2, accuracy: 67 },
      matches: 37,
      t: fakeT(),
    }),
    "leaderboard.picksHit · leaderboard.phasePicks",
  );
});

test("klucz phasePicks istnieje we WSZYSTKICH jezykach i ma formy", async () => {
  // Brakujaca forma nie wywraca strony - po prostu w rosyjskim wierszu
  // staje polskie zdanie albo samo "{count}". Test kluczy w language.test.js
  // pilnuje zestawow; tutaj chodzi o to, ze ten konkretny klucz jest
  // ODMIENIANY, a nie wpisany jednym napisem.
  const { SLOWNIKI } = await import("../web/src/i18n/index.js");

  const TRZY_FORMY = new Set(["pl", "ru", "uk"]);

  for (const [jezyk, slownik] of Object.entries(SLOWNIKI)) {
    const wpis = slownik["leaderboard.phasePicks"];

    assert.equal(
      typeof wpis,
      "object",
      `${jezyk}: phasePicks musi miec formy liczby mnogiej`,
    );

    const oczekiwane = TRZY_FORMY.has(jezyk)
      ? ["one", "few", "many"]
      : ["one", "other"];

    assert.deepEqual(
      Object.keys(wpis).sort(),
      [...oczekiwane].sort(),
      `${jezyk}: nie te formy`,
    );

    for (const forma of oczekiwane) {
      assert.match(
        wpis[forma],
        /\{count\}/,
        `${jezyk}.${forma}: brak miejsca na liczbe`,
      );
    }
  }
});
