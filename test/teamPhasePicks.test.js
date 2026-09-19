// Typy fazowe zsumowane na poziomie druzyny (server/lib/teamPhasePicks.js).
//
// Zmierzone na produkcji: GamerLegion typowana na awans 484 razy przy 11%
// trafnosci, PARIVISION 347 razy przy 87%, Imperial skazywana na 0-3
// 285 razy i ANI RAZU slusznie - a na awans 76 razy przy 95%.
//
// Siedem druzyn gralo wylacznie w turnieju bez zapisanych meczow, wiec bez
// tego modulu nie istnialy na stronie wcale.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/teamPhasePicks.js";

function typ({ event_id = 1, stage = "stage1", pick_3_0 = "", pick_0_3 = "", advancing = "" } = {}) {
  return { event_id, stage, pick_3_0, pick_0_3, advancing };
}

function wynik({ event_id = 1, stage = "stage1", correct_3_0 = "", correct_0_3 = "", correct_advancing = "" } = {}) {
  return { event_id, stage, correct_3_0, correct_0_3, correct_advancing };
}

function powtorz(ile, wzor) {
  return Array.from({ length: ile }, () => ({ ...wzor }));
}

test("liczy typy i trafnosc osobno dla kazdej z trzech grup", async () => {
  const { buildTeamPhasePicks } = await import(MODUL);

  const mapa = buildTeamPhasePicks(
    [typ({ advancing: "B8", pick_3_0: "B8", pick_0_3: "MIBR" })],
    [wynik({ correct_advancing: "B8", correct_3_0: "Spirit", correct_0_3: "MIBR" })],
  );

  const b8 = mapa.get("b8");

  assert.equal(b8.advance.picks, 1);
  assert.equal(b8.advance.hit, 100);

  assert.equal(b8.three_zero.picks, 1);
  assert.equal(b8.three_zero.hit, 0, "typowany na 3-0, poszedl kto inny");

  assert.equal(mapa.get("mibr").zero_three.hit, 100);
});

test("etap BEZ wyniku liczy sie do typow, ale nie do trafnosci", async () => {
  // Inaczej nierozstrzygnieta faza zanizalaby kazda druzyne do zera.
  const { buildTeamPhasePicks } = await import(MODUL);

  const mapa = buildTeamPhasePicks(
    [
      ...powtorz(3, typ({ advancing: "B8", stage: "stage1" })),
      ...powtorz(2, typ({ advancing: "B8", stage: "stage2" })),
    ],
    [wynik({ stage: "stage1", correct_advancing: "B8" })],
  );

  const b8 = mapa.get("b8");

  assert.equal(b8.advance.picks, 5, "wszystkie typy sie licza");
  assert.equal(b8.advance.settled, 3, "tylko etap 1 ma wynik");
  assert.equal(b8.advance.hit, 100, "3 z 3 rozstrzygnietych");
});

test("brak typow to null, a nie zero procent", async () => {
  // "Nikt nie typowal" i "typowali i sie mylili" to dwie rozne rzeczy.
  const { buildTeamPhasePicks } = await import(MODUL);

  const mapa = buildTeamPhasePicks([typ({ advancing: "B8" })], []);

  const b8 = mapa.get("b8");

  assert.equal(b8.zero_three.picks, 0);
  assert.equal(b8.zero_three.hit, null);
  assert.equal(b8.advance.hit, null, "etap bez wyniku tez daje null");
});

test("ta sama druzyna dwa razy w jednym polu liczy sie RAZ", async () => {
  const { buildTeamPhasePicks } = await import(MODUL);

  const mapa = buildTeamPhasePicks([typ({ advancing: "B8, B8, MIBR" })], []);

  assert.equal(mapa.get("b8").advance.picks, 1);
  assert.equal(mapa.get("mibr").advance.picks, 1);
});

test("rozne zapisy nazwy to jedna druzyna, a nazwa idzie z wiekszosci", async () => {
  const { buildTeamPhasePicks } = await import(MODUL);

  const mapa = buildTeamPhasePicks(
    [
      ...powtorz(7, typ({ advancing: "PARIVISION" })),
      ...powtorz(3, typ({ advancing: "Parivision" })),
    ],
    [],
  );

  assert.equal(mapa.size, 1);
  assert.equal([...mapa.values()][0].advance.picks, 10);
  assert.equal([...mapa.values()][0].name, "PARIVISION");
});

test("FaZe z meczow i FaZe Clan z faz to ta sama druzyna", async () => {
  // Mecze zapisuja "FaZe", tabele faz "FaZe Clan" - jedna organizacja pod
  // dwoma kluczami. Przez to 506 typow na awans nie nalezalo do nikogo.
  const { buildTeamPhasePicks } = await import(MODUL);
  const { teamKey } = await import("../server/lib/teamLogos.js");

  assert.equal(teamKey("FaZe Clan"), teamKey("FaZe"), "klucze musza byc rowne");

  const mapa = buildTeamPhasePicks([typ({ advancing: "FaZe Clan" })], [], {
    logos: [{ name_key: teamKey("FaZe"), logo_url: "https://x/faze.png" }],
  });

  assert.equal(mapa.get(teamKey("FaZe")).logo, "https://x/faze.png");
});

test("total zlicza wszystkie trzy grupy - po nim sortuje sie druzyny bez meczow", async () => {
  const { buildTeamPhasePicks } = await import(MODUL);

  const mapa = buildTeamPhasePicks(
    [typ({ advancing: "B8", pick_3_0: "B8", pick_0_3: "B8" })],
    [],
  );

  assert.equal(mapa.get("b8").total, 3);
});

test("brak wierszy nie wywraca liczenia", async () => {
  const { buildTeamPhasePicks } = await import(MODUL);

  assert.equal(buildTeamPhasePicks([], []).size, 0);
  assert.equal(buildTeamPhasePicks(null, null).size, 0);
});
