// Kiedy typowanie jest otwarte.
//
// Trescia obu regul jest KOLEJNOSC powodow blokady, bo z niej wynika, ktory
// komunikat zobaczy gracz. Mecz moze byc naraz zakonczony, zablokowany i po
// deadlinie - i ma wtedy powiedziec "zakonczony", a nie cokolwiek innego.
//
// Zaleznosci sa wstrzykiwane, wiec nie potrzeba ani bazy, ani Discorda.

const test = require("node:test");
const assert = require("node:assert/strict");

const GATE = "../server/lib/predictionGate.js";

const OTWARTY = { allowed: true };
const ZAMKNIETY = { allowed: false, message: "❌ Turniej **NOT_STARTED**." };

// Domyslnie wszystko przepuszcza - kazdy test psuje tylko to, co bada.
async function gate(nadpisania = {}) {
  const { createPredictionGate } = await import(GATE);

  const wywolania = { deadlineMeczowy: 0, deadlinePanelu: 0 };

  const instancja = createPredictionGate({
    pool: {},
    assertPredictionsAllowed: async () => OTWARTY,
    isPickDeadlinePassed: async () => {
      wywolania.deadlinePanelu += 1;
      return { passed: false };
    },
    isMatchDeadlinePassed: async () => {
      wywolania.deadlineMeczowy += 1;
      return { passed: false };
    },
    isMatchLocked: () => false,
    matchPanelPhaseFor: (phase) => (phase ? "swiss" : null),
    toWebMessage: (tekst, zapasowy) => tekst || zapasowy,
    pickemPanelPhase: { SWISS: "swiss", PLAYOFFS: "playoffs" },
    ...nadpisania,
  });

  return { ...instancja, wywolania };
}

function mecz(pola = {}) {
  return { id: 1, phase: "swiss_stage1", ui_status: "OPEN", ...pola };
}

test("mecz bez przeszkod jest otwarty", async () => {
  const { resolveMatchPredictionState } = await gate();

  const stan = await resolveMatchPredictionState({
    match: mecz(),
    gate: OTWARTY,
    guildId: "1",
    deadlineCache: new Map(),
  });

  assert.equal(stan.predictions_allowed, true);
  assert.equal(stan.ui_status, "OPEN");
  assert.equal(stan.lock_reason, null);
});

test("zakonczony mecz bije wszystkie pozostale powody", async () => {
  // Naraz: zakonczony, gate zamkniety, mecz zablokowany, deadline miniety.
  const { resolveMatchPredictionState } = await gate({
    isMatchLocked: () => true,
    isMatchDeadlinePassed: async () => ({ passed: true }),
  });

  const stan = await resolveMatchPredictionState({
    match: mecz({ ui_status: "FINAL" }),
    gate: ZAMKNIETY,
    guildId: "1",
    deadlineCache: new Map(),
  });

  assert.equal(stan.ui_status, "FINAL");
  assert.match(stan.lock_reason, /zakończony/);
});

test("zamkniety gate turnieju bije blokade meczu i deadline", async () => {
  const { resolveMatchPredictionState } = await gate({
    isMatchLocked: () => true,
    isMatchDeadlinePassed: async () => ({ passed: true }),
  });

  const stan = await resolveMatchPredictionState({
    match: mecz(),
    gate: ZAMKNIETY,
    guildId: "1",
    deadlineCache: new Map(),
  });

  assert.equal(stan.ui_status, "LOCKED");
  // Komunikat guarda przechodzi przez toWebMessage, a nie leci surowy.
  assert.equal(stan.lock_reason, ZAMKNIETY.message);
});

test("blokada meczu bije deadline fazy", async () => {
  const { resolveMatchPredictionState } = await gate({
    isMatchLocked: () => true,
    isMatchDeadlinePassed: async () => ({ passed: true }),
  });

  const stan = await resolveMatchPredictionState({
    match: mecz(),
    gate: OTWARTY,
    guildId: "1",
    deadlineCache: new Map(),
  });

  assert.equal(stan.ui_status, "LOCKED");
  assert.match(stan.lock_reason, /zablokowany/);
});

test("miniety deadline fazy zamyka mecz", async () => {
  const { resolveMatchPredictionState } = await gate({
    isMatchDeadlinePassed: async () => ({ passed: true }),
  });

  const stan = await resolveMatchPredictionState({
    match: mecz(),
    gate: OTWARTY,
    guildId: "1",
    deadlineCache: new Map(),
  });

  assert.equal(stan.ui_status, "LOCKED");
  assert.match(stan.lock_reason, /[Dd]eadline/);
});

test("mecz bez fazy panelu nie pyta o deadline w ogole", async () => {
  const { resolveMatchPredictionState, wywolania } = await gate({
    matchPanelPhaseFor: () => null,
  });

  const stan = await resolveMatchPredictionState({
    match: mecz(),
    gate: OTWARTY,
    guildId: "1",
    deadlineCache: new Map(),
  });

  assert.equal(stan.ui_status, "OPEN");
  assert.equal(wywolania.deadlineMeczowy, 0);
});

test("deadline pyta sie raz na faze, a nie raz na mecz", async () => {
  const { resolveMatchPredictionState, wywolania } = await gate();

  // To jest powod istnienia cache'u: lista 106 meczow pytalaby 106 razy.
  const cache = new Map();

  for (const id of [1, 2, 3, 4, 5]) {
    await resolveMatchPredictionState({
      match: mecz({ id }),
      gate: OTWARTY,
      guildId: "1",
      deadlineCache: cache,
    });
  }

  assert.equal(wywolania.deadlineMeczowy, 1, "piec meczow jednej fazy, jedno pytanie");
});

test("saved_maps zawsze wraca liczba", async () => {
  const { resolveMatchPredictionState } = await gate();

  const stan = await resolveMatchPredictionState({
    match: mecz({ saved_maps: null }),
    gate: OTWARTY,
    guildId: "1",
    deadlineCache: new Map(),
  });

  assert.equal(stan.saved_maps, 0);
});

test("gate pickem: zamkniety turniej nie pyta nawet o deadline", async () => {
  const { checkPickemGate, wywolania } = await gate({
    assertPredictionsAllowed: async () => ZAMKNIETY,
  });

  const wynik = await checkPickemGate("1", "SWISS");

  assert.equal(wynik.allowed, false);
  assert.equal(wynik.message, ZAMKNIETY.message, "powod zostaje ten z guarda");
  assert.equal(wywolania.deadlinePanelu, 0);
});

test("gate pickem: otwarty turniej po deadlinie i tak odmawia", async () => {
  const { checkPickemGate } = await gate({
    isPickDeadlinePassed: async () => ({ passed: true }),
  });

  const wynik = await checkPickemGate("1", "SWISS");

  assert.equal(wynik.allowed, false);
  assert.match(wynik.message, /[Dd]eadline/);
});

test("gate pickem: otwarty turniej przed deadlinem przepuszcza", async () => {
  const { checkPickemGate } = await gate();

  const wynik = await checkPickemGate("1", "SWISS");

  assert.equal(wynik.allowed, true);
});
