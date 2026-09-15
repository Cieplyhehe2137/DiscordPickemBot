// Pobieranie typow druzyn z bazy (loadTeamPicks w server/lib/teamPicks.js).
//
// Testy o WYDAJNOSCI, nie tylko o wyniku. Kazde zapytanie to osobna podroz do
// bazy, ktora stoi na innej maszynie niz API - zmierzone na produkcji okolo
// 165 ms, niezaleznie od tego, ile wierszy wraca. Szesc faz razy trzy
// zapytania jedno po drugim to osiemnascie podrozy i blisko trzy sekundy
// czekania na dane, ktore nic o sobie nawzajem nie wiedza.
//
// Dlatego test sprawdza nie tylko CO wraca, ale ILOMA falami. Bez tego
// przepisanie tego z powrotem na petle z await w srodku przechodziloby na
// zielono i strona profilu po cichu wracalaby do szesciu sekund.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/teamPicks.js";

// Atrapa puli. Zapisuje, ktore zapytanie poszlo i w ktorej fali - falą jest
// zestaw zapytan wystrzelonych, zanim ktorekolwiek z nich sie rozwiazalo.
function fakePool(odpowiedzi) {
  const wywolania = [];

  let falaNr = 0;
  let wFali = 0;

  return {
    wywolania,

    get fal() {
      return falaNr;
    },

    query(sql, args) {
      // Nowa fala zaczyna sie wtedy, gdy wystrzelono zapytanie, a poprzednie
      // jeszcze nie zdazyly wrocic.
      if (wFali === 0) falaNr += 1;

      wFali += 1;

      const tabela = String(sql).match(/FROM\s+(\w+)/i)?.[1] ?? "?";

      wywolania.push({ tabela, args, fala: falaNr });

      return new Promise((resolve) => {
        setTimeout(() => {
          wFali -= 1;
          resolve([odpowiedzi[tabela] ?? [], []]);
        }, 0);
      });
    },
  };
}

const ARGS = { guildId: "g1", eventId: 7, userId: "u1" };

test("typy wszystkich faz ida jedna fala, nie jedno po drugim", async () => {
  const { loadTeamPicks } = await import(MODUL);

  const pool = fakePool({
    swiss_predictions: [{ pick_3_0: "FaZe", pick_0_3: "", advancing: "" }],
  });

  await loadTeamPicks(pool, ARGS);

  const typy = pool.wywolania.filter((w) => w.tabela.endsWith("_predictions"));

  assert.equal(typy.length, 6, "szesc faz to szesc zapytan o typ");

  // Wszystkie w tej samej fali - czyli wystrzelone razem.
  assert.deepEqual([...new Set(typy.map((t) => t.fala))], [1]);
});

test("o wynik i punkty pyta tylko dla faz, w ktorych cos obstawiono", async () => {
  // Gracz ma typ wylacznie w fazie szwajcarskiej. Pytanie o wynik playoffow
  // byloby podroza po nic.
  const { loadTeamPicks } = await import(MODUL);

  const pool = fakePool({
    swiss_predictions: [{ pick_3_0: "FaZe", pick_0_3: "", advancing: "" }],
  });

  await loadTeamPicks(pool, ARGS);

  const wyniki = pool.wywolania.filter((w) => w.tabela.endsWith("_results"));
  const punkty = pool.wywolania.filter((w) => w.tabela.endsWith("_scores"));

  // Trzy etapy szwajcarskie maja ten sam typ, bo atrapa oddaje go dla kazdego
  // zapytania do swiss_predictions - wiec trzy razy wynik i trzy razy punkty.
  assert.equal(wyniki.length, 3);
  assert.equal(punkty.length, 3);

  assert.ok(
    wyniki.every((w) => w.tabela === "swiss_results"),
    "zadnego pytania o playoffy, play-in ani double elim",
  );
});

test("wszystko razem miesci sie w dwoch falach", async () => {
  const { loadTeamPicks } = await import(MODUL);

  const pool = fakePool({
    swiss_predictions: [{ pick_3_0: "FaZe", pick_0_3: "", advancing: "" }],
    playoffs_predictions: [{ winner: "Vitality" }],
  });

  await loadTeamPicks(pool, ARGS);

  assert.equal(pool.fal, 2, "fala typow i fala wynikow z punktami");
});

test("gracz bez zadnego typu konczy po jednej fali", async () => {
  const { loadTeamPicks } = await import(MODUL);

  const pool = fakePool({});

  const fazy = await loadTeamPicks(pool, ARGS);

  assert.deepEqual(fazy, []);
  assert.equal(pool.wywolania.length, 6, "tylko pytania o typ");
  assert.equal(pool.fal, 1);
});

test("faza trafia do wyniku z wlasnym typem, a nie cudzym", async () => {
  // Rownolegle zapytania wracaja w dowolnej kolejnosci. Gdyby laczyc je
  // z fazami po kolejnosci powrotu zamiast po indeksie, typ playoffow
  // wyladowalby w fazie szwajcarskiej.
  const { loadTeamPicks } = await import(MODUL);

  const pool = fakePool({
    swiss_predictions: [{ pick_3_0: "FaZe, MOUZ", pick_0_3: "", advancing: "" }],
    playoffs_predictions: [{ winner: "Vitality" }],
    swiss_results: [{ correct_3_0: "FaZe" }],
  });

  const fazy = await loadTeamPicks(pool, ARGS);

  const swiss = fazy.find((f) => f.phase === "stage1");
  const playoffs = fazy.find((f) => f.phase === "playoffs");

  assert.equal(swiss.kind, "swiss");
  assert.deepEqual(swiss.groups[0].picked, ["FaZe", "MOUZ"]);
  assert.deepEqual(swiss.groups[0].correct, ["FaZe"]);
  assert.equal(swiss.published, true);

  assert.equal(playoffs.kind, "playoffs");
  assert.deepEqual(playoffs.groups[0].picked, ["Vitality"]);

  // Playoffy nie maja wiersza wyniku w atrapie.
  assert.equal(playoffs.published, false);
});

test("punkty fazy czytane sa z wlasnego wiersza", async () => {
  const { loadTeamPicks } = await import(MODUL);

  const pool = fakePool({
    playoffs_predictions: [{ winner: "Vitality" }],
    playoffs_scores: [{ points: 12 }],
  });

  const fazy = await loadTeamPicks(pool, ARGS);

  assert.equal(fazy[0].points, 12);
});

test("brak wiersza punktow to null, a nie zero", async () => {
  // Zero znaczy "grał i nie zdobył", null znaczy "jeszcze nie policzono".
  const { loadTeamPicks } = await import(MODUL);

  const pool = fakePool({
    playoffs_predictions: [{ winner: "Vitality" }],
  });

  const fazy = await loadTeamPicks(pool, ARGS);

  assert.equal(fazy[0].points, null);
});
