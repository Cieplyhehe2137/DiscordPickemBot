// Zamrazanie faz typowania druzyn.
//
// Regula: limity fazy wolno zmieniac tylko dopoki nikt w niej nie typowal i nie
// ma wpisanego wyniku. Pozniej zapisane typy byly sprawdzane wobec INNYCH liczb,
// a zmiana limitu ich nie uniewaznia ani nie przelicza - turniej zaczyna sie po
// prostu nie zgadzac sam ze soba.
//
// Regula dotyka bazy, ale wylacznie przez `pool`, wiec atrapa puli wystarcza,
// zeby sprawdzic ja bez MySQL-a. Atrapa odwzorowuje ksztalt odpowiedzi mysql2:
// query() oddaje [rows], a wolajacy destrukturyzuje to dalej.

const test = require("node:test");
const assert = require("node:assert/strict");

const FROZEN = "../server/lib/frozenPhases.js";

const PHASES = ["stage1", "stage2", "stage3", "playoffs", "playin", "doubleelim"];

// Prawdziwa normalizacja, nie jej kopia.
//
// Wczesniej test mial tu wlasna wersje normalizePhase, bo oryginal siedzial
// w protectionsGuards.js, ktory przez logger ciagnie winstona, a przez
// guildContext cale mysql2 - a zadanie `testy` w CI chodzi bez `npm ci`.
// Kopia zdazyla sie rozjechac: brakowalo w niej aliasow playoffs, playin
// i doubleelim i przechodzila tylko dlatego, ze dla tych trzech wartosci
// samo toUpperCase() daje przypadkiem ten sam wynik.
//
// Funkcja mieszka teraz w utils/phaseNames.js, ktory nie ma zadnego importu,
// wiec test laduje dokladnie to, co wykonuje produkcja.
const { normalizePhase } = require("../utils/phaseNames.js");

// event: wiersz z tabeli events; swiss: lista {stage}; counts: liczniki faz.
function fakePool({ event = {}, swiss = [], counts = {} } = {}) {
  const zapytania = [];

  return {
    zapytania,
    async query(sql) {
      zapytania.push(sql);

      if (sql.includes("FROM events")) return [[event]];
      if (sql.includes("swiss_predictions")) return [swiss];

      return [[{ playoffs: 0, playin: 0, doubleelim: 0, ...counts }]];
    },
  };
}

async function frozenFor(opcje) {
  const { createFrozenPhases } = await import(FROZEN);

  const { getFrozenPhases } = createFrozenPhases({
    pool: fakePool(opcje),
    phases: PHASES,
    normalizePhase,
  });

  return getFrozenPhases(1);
}

test("otwarty event bez typow nie ma nic zamrozonego", async () => {
  const frozen = await frozenFor({ event: { status: "OPEN", is_archived: 0 } });

  assert.deepEqual(frozen, {});
});

test("zakonczony event zamraza wszystkie fazy, takze puste", async () => {
  const { FROZEN_EVENT_OVER } = await import(FROZEN);

  const frozen = await frozenFor({
    event: { status: "FINISHED", is_archived: 0 },
  });

  // Takze te, w ktorych nikt nie typowal - inaczej dalo by sie zmienic opis
  // formatu turnieju juz rozegranego.
  assert.deepEqual(Object.keys(frozen).sort(), [...PHASES].sort());
  assert.equal(frozen.stage2, FROZEN_EVENT_OVER);
});

test("zarchiwizowany event tez jest zamrozony w calosci", async () => {
  const { FROZEN_EVENT_OVER } = await import(FROZEN);

  const frozen = await frozenFor({ event: { status: "OPEN", is_archived: 1 } });

  assert.equal(Object.keys(frozen).length, PHASES.length);
  assert.equal(frozen.playoffs, FROZEN_EVENT_OVER);
});

test("etap Swiss z typami zamraza sie, reszta zostaje otwarta", async () => {
  const { FROZEN_HAS_PICKS } = await import(FROZEN);

  const frozen = await frozenFor({
    event: { status: "OPEN", is_archived: 0 },
    swiss: [{ stage: "stage1" }],
  });

  assert.deepEqual(frozen, { stage1: FROZEN_HAS_PICKS });
});

test("warianty zapisu etapu trafiaja w ten sam klucz", async () => {
  const { FROZEN_HAS_PICKS } = await import(FROZEN);

  // To jest powod istnienia przelozenia przez normalizePhase: kolumna trzyma
  // rozne zapisy, a konfiguracja kluczuje po 'stageN'. Bez tego zaden etap
  // Swiss nigdy by sie nie zamrozil.
  for (const zapis of ["stage2", "SWISS_STAGE2", "swiss_stage2", "swiss_stage_2", " Stage2 "]) {
    const frozen = await frozenFor({
      event: { status: "OPEN", is_archived: 0 },
      swiss: [{ stage: zapis }],
    });

    assert.deepEqual(frozen, { stage2: FROZEN_HAS_PICKS }, `zapis: ${zapis}`);
  }
});

test("zapis spoza tablicy aliasow nie zamraza nic - i tak ma byc", async () => {
  // "Stage 2" ze spacja daje klucz stage_2, ktorego w tablicy nie ma. To nie
  // jest przeoczenie testu, tylko rzeczywiste ograniczenie: rozpoznawane sa
  // konkretne zapisy, a nie dowolne warianty. Zapisane tutaj, zeby przy
  // nastepnej zmianie bylo widac, ze to swiadome.
  const frozen = await frozenFor({
    event: { status: "OPEN", is_archived: 0 },
    swiss: [{ stage: "Stage 2" }],
  });

  assert.deepEqual(frozen, {});
});

test("nieznany albo pusty etap jest pomijany, a nie wysypuje reguly", async () => {
  const frozen = await frozenFor({
    event: { status: "OPEN", is_archived: 0 },
    swiss: [{ stage: null }, { stage: "stage9" }, { stage: "bzdura" }],
  });

  assert.deepEqual(frozen, {});
});

test("licznik wiekszy od zera zamraza faze poza Swissem", async () => {
  const { FROZEN_HAS_PICKS } = await import(FROZEN);

  const frozen = await frozenFor({
    event: { status: "OPEN", is_archived: 0 },
    counts: { playoffs: 3, playin: 0, doubleelim: 1 },
  });

  assert.deepEqual(frozen, {
    playoffs: FROZEN_HAS_PICKS,
    doubleelim: FROZEN_HAS_PICKS,
  });
});

test("brak eventu w bazie nie zamraza wszystkiego na wszelki wypadek", async () => {
  // Nieistniejacy event nie jest "zakonczony" - gdyby nim byl, literowka w id
  // zamrazalaby konfiguracje bez powodu.
  const frozen = await frozenFor({ event: undefined });

  assert.deepEqual(frozen, {});
});

test("aliasy faz spoza Swissa nie moga zniknac", () => {
  // Te wpisy dlugo istnialy tylko w kodzie produkcyjnym: kopia normalizePhase
  // trzymana w tym pliku ich nie miala, a mimo to przechodzila, bo dla samego
  // "playoffs", "playin" i "doubleelim" toUpperCase() daje przypadkiem ten sam
  // wynik co tablica. Roznica wychodzi dopiero na wariantach zapisu - i to one
  // sa tutaj sprawdzane, zeby usuniecie wpisu z tablicy bylo widac od razu.
  const oczekiwane = {
    playoffs: "PLAYOFFS",

    playin: "PLAYIN",
    play_in: "PLAYIN",
    "PLAY-IN": "PLAYIN",

    double: "DOUBLEELIM",
    doubleelim: "DOUBLEELIM",
    double_elim: "DOUBLEELIM",
    double_elimination: "DOUBLEELIM",
    "Double Elimination": "DOUBLEELIM",

    match: "MATCHES",
    matches: "MATCHES",

    swiss: "SWISS",
  };

  for (const [zapis, klucz] of Object.entries(oczekiwane)) {
    assert.equal(normalizePhase(zapis), klucz, `zapis: ${zapis}`);
  }
});

test("nieznana faza wraca wielkimi literami, bez wyjatku", () => {
  // Fallback jest celowy: nieznana faza ma nie pasowac do niczego dalej,
  // ale tez nie wysypac reguly.
  assert.equal(normalizePhase("cos_czego_nie_ma"), "COS_CZEGO_NIE_MA");
  assert.equal(normalizePhase(""), "");
  assert.equal(normalizePhase(null), "");
  assert.equal(normalizePhase(undefined), "");
});
