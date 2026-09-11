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

// Odwzorowanie normalizePhase z utils/protectionsGuards.js.
//
// Nie importuje oryginalu, bo ciagnie za soba winstona i luxona, a testy w tym
// katalogu maja dzialac bez instalowania zaleznosci (tak chodzi zadanie w CI).
// Kopia trzyma sie oryginalu tam, gdzie to istotne: dopasowanie idzie po
// TABLICY ALIASOW, a nie wzorcem - dlatego "stage2" trafia, a "stage_2" nie.
const ALIASY = {
  swiss_stage_1: "SWISS_STAGE1",
  swiss_stage1: "SWISS_STAGE1",
  stage1: "SWISS_STAGE1",
  swiss_stage_2: "SWISS_STAGE2",
  swiss_stage2: "SWISS_STAGE2",
  stage2: "SWISS_STAGE2",
  swiss_stage_3: "SWISS_STAGE3",
  swiss_stage3: "SWISS_STAGE3",
  stage3: "SWISS_STAGE3",
};

function normalizePhase(value) {
  const klucz = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return ALIASY[klucz] || klucz.toUpperCase();
}

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
