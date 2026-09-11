// Etykiety faz i map na froncie.
//
// Kolumny events.phase i matches.phase trzymaja surowe identyfikatory w kilku
// wariantach zapisu naraz (SWISS_STAGE_1, swiss_stage1, DOUBLE_ELIM), bo
// pochodza z roznych czesci bota i z roznych okresow. Bez tej normalizacji
// trafialy na ekran w tej postaci.
//
// Nieznana faza ma pokazac SWOJA surowa wartosc, a nie myslnik czy pustke -
// wtedy przynajmniej wiadomo, czego szukac w bazie.

const test = require("node:test");
const assert = require("node:assert/strict");

const PHASE = "../web/src/lib/phaseLabels.js";
const MAPS = "../web/src/lib/mapLabels.js";

test("warianty zapisu tej samej fazy daja te sama etykiete", async () => {
  const { humanPhase } = await import(PHASE);

  for (const zapis of ["swiss_stage1", "SWISS_STAGE_1", "Swiss Stage 1", "stage1"]) {
    assert.equal(humanPhase(zapis), "Swiss Stage 1", zapis);
  }

  for (const zapis of ["doubleelim", "DOUBLE_ELIM", "double elimination"]) {
    assert.equal(humanPhase(zapis), "Double Elimination", zapis);
  }

  for (const zapis of ["playin", "PLAY_IN", "play-in"]) {
    assert.equal(humanPhase(zapis), "Play-In", zapis);
  }
});

test("brak fazy to myslnik, nieznana faza zostaje surowa", async () => {
  const { humanPhase } = await import(PHASE);

  assert.equal(humanPhase(null), "—");
  assert.equal(humanPhase(""), "—");

  // Lepiej pokazac NOWA_FAZA_2027 niz pusto - widac, czego szukac.
  assert.equal(humanPhase("NOWA_FAZA_2027"), "NOWA_FAZA_2027");
});

test("stany turnieju tez maja czytelne nazwy", async () => {
  const { humanPhase } = await import(PHASE);

  assert.equal(humanPhase("NOT_STARTED"), "Nie rozpoczęty");
  assert.equal(humanPhase("FINISHED"), "Zakończony");
});

test("etykieta fazy z adresu dziala na malych literach", async () => {
  const { phaseRouteLabel } = await import(PHASE);

  assert.equal(phaseRouteLabel("stage2"), "Swiss Stage 2");
  assert.equal(phaseRouteLabel("playoffs"), "Playoffs");
  assert.equal(phaseRouteLabel("cokolwiek"), "cokolwiek", "nieznane zostaje");
});

test("nazwy map w BO3 opisuja, kto wybieral", async () => {
  const { getMapLabel } = await import(MAPS);

  assert.equal(getMapLabel(1, 3, "NAVI", "Vitality"), "Pick NAVI");
  assert.equal(getMapLabel(2, 3, "NAVI", "Vitality"), "Pick Vitality");
  assert.equal(getMapLabel(3, 3, "NAVI", "Vitality"), "Decider");
});

test("nazwy map w BO5 na przemian, ostatnia decydujaca", async () => {
  const { getMapLabel } = await import(MAPS);

  assert.equal(getMapLabel(1, 5, "A", "B"), "Pick A");
  assert.equal(getMapLabel(2, 5, "A", "B"), "Pick B");
  assert.equal(getMapLabel(3, 5, "A", "B"), "Pick A");
  assert.equal(getMapLabel(4, 5, "A", "B"), "Pick B");
  assert.equal(getMapLabel(5, 5, "A", "B"), "Decider");
});

test("brak nazwy druzyny nie zostawia pustego miejsca", async () => {
  const { getMapLabel } = await import(MAPS);

  assert.equal(getMapLabel(1, 3, null, null), "Pick Team A");
  assert.equal(getMapLabel(2, 3, "", ""), "Pick Team B");
});

test("mapa spoza zakresu BO dostaje numer zamiast pustki", async () => {
  const { getMapLabel } = await import(MAPS);

  assert.equal(getMapLabel(4, 3, "A", "B"), "Mapa #4");
  assert.equal(getMapLabel(6, 5, "A", "B"), "Mapa #6");
});

test("BO1 ma jedna mape i wlasna etykiete", async () => {
  const { getMapLabel } = await import(MAPS);

  // W BO1 nie ma picku ani decidera - jest jedna mapa i tyle.
  assert.equal(getMapLabel(1, 1, "A", "B"), "BO1");
});

test("bot i front nazywaja mapy identycznie", async () => {
  const web = await import(MAPS);
  const bot = require("../utils/mapLabels.js");

  // Trzecia para kopii tej samej reguly w tym repo (obok odmiany i uprawnien).
  // Rozjazd znaczylby, ze ten sam mecz ma inny opis na Discordzie i na WWW.
  const rozjazdy = [];

  for (const bo of [1, 3, 5, 7]) {
    for (let no = 1; no <= 6; no += 1) {
      const a = web.getMapLabel(no, bo, "NAVI", "Vitality");
      const b = bot.getMapLabel(no, bo, "NAVI", "Vitality");
      if (a !== b) rozjazdy.push(`mapa ${no} w BO${bo}: front=${a} bot=${b}`);
    }

    if (web.maxMapsFromBo(bo) !== bot.maxMapsFromBo(bo)) {
      rozjazdy.push(`maxMapsFromBo(${bo})`);
    }
  }

  assert.deepEqual(rozjazdy, []);
});

test("liczba map wynika z formatu serii", async () => {
  const { maxMapsFromBo } = await import(MAPS);

  assert.equal(maxMapsFromBo(1), 1);
  assert.equal(maxMapsFromBo(3), 3);
  assert.equal(maxMapsFromBo(5), 5);

  // Nieznany format traktowany jak BO5 - lepiej pokazac za duzo pol niz
  // uciac mape, ktora faktycznie sie odbyla.
  assert.equal(maxMapsFromBo(7), 5);
  assert.equal(maxMapsFromBo(null), 5);
});
