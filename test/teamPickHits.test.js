// Oznaczanie trafien w typach druzyn (web/src/lib/teamPickHits.js).
//
// Wyciagniete z komponentu PhaseResults, zeby profil gracza i strona fazy
// liczyly trafienia tym samym kodem. Dwie kopie tego porownania to dwa
// miejsca, w ktorych "trafione" moze zaczac znaczyc co innego - a gracz
// zobaczylby wtedy inna liczbe na profilu niz na stronie fazy.
//
// Modul nie importuje niczego, wiec dziala bez instalowania zaleznosci.

const test = require("node:test");
const assert = require("node:assert/strict");

const HITS = "../web/src/lib/teamPickHits.js";

test("znakuje trafienia i pudla", async () => {
  const { markHits } = await import(HITS);

  assert.deepEqual(markHits(["B8", "NRG"], ["B8", "BetBoom"]), [
    { team: "B8", hit: true },
    { team: "NRG", hit: false },
  ]);
});

test("brak wyniku znaczy brak trafien, a nie wywrotke", async () => {
  // Faza z typem, ale bez opublikowanego wyniku.
  const { markHits } = await import(HITS);

  assert.deepEqual(markHits(["B8"], null), [{ team: "B8", hit: false }]);
  assert.deepEqual(markHits(["B8"], []), [{ team: "B8", hit: false }]);
});

test("brak typow daje pusta liste", async () => {
  const { markHits } = await import(HITS);

  assert.deepEqual(markHits(null, ["B8"]), []);
  assert.deepEqual(markHits(undefined, undefined), []);
});

test("porownanie jest doslowne, bez ignorowania wielkosci liter", async () => {
  // Typy i wyniki pochodza z tej samej listy druzyn, wiec zapis sie zgadza.
  // Gdyby kiedys przestal, lepiej zeby bylo to widac jako pudlo niz zeby
  // trafienia liczyly sie inaczej niz punkty w calculateScores.
  const { markHits } = await import(HITS);

  assert.deepEqual(markHits(["b8"], ["B8"]), [{ team: "b8", hit: false }]);
});

test("liczy trafienia w wielu grupach naraz", async () => {
  const { countHits } = await import(HITS);

  const wynik = countHits([
    { picked: ["B8", "NRG"], correct: ["B8"] },
    { picked: ["Spirit", "FURIA", "Aurora"], correct: ["Spirit", "Aurora"] },
  ]);

  assert.deepEqual(wynik, { hits: 3, total: 5 });
});

test("pusta lista grup to zero z zera, a nie NaN", async () => {
  const { countHits } = await import(HITS);

  assert.deepEqual(countHits([]), { hits: 0, total: 0 });
  assert.deepEqual(countHits(), { hits: 0, total: 0 });
});

test("inicjal druzyny zastepuje logo", async () => {
  // Logotypow nie ma skad wziac - teams.logo_url jest puste we wszystkich
  // wierszach, a druzyny z typow nie maja tam nawet swoich wierszy.
  const { teamInitial } = await import(HITS);

  assert.equal(teamInitial("GamerLegion"), "G");
  assert.equal(teamInitial("  spirit"), "S");
  assert.equal(teamInitial("9z"), "9");
});

test("brak nazwy nie zostawia pustego kolka", async () => {
  const { teamInitial } = await import(HITS);

  assert.equal(teamInitial(""), "?");
  assert.equal(teamInitial(null), "?");
});
