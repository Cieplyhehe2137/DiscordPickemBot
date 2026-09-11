// Mecz bez wyniku nie dostaje punktów — nawet zerowych.
//
// recalculateMatchPoints szło dalej mimo braku wiersza w match_results.
// computeSeriesPoints przy null zwraca 0, a pętla zapisywała ten 0 każdemu,
// kto wytypował, więc mecz bez wyniku dostawał komplet wierszy match_points
// z zerami. Klasyfikacja się zgadzała (zero sumuje się jak brak wpisu), ale
// rozbicie na punkty za serię i mapy pokazywało zera przy poprawnie
// wytypowanym meczu.
//
// Tak zniknęło rozbicie całego IEM Kraków 2026: 3904 typy × 2 źródła = 7808
// wierszy, wszystkie z zerem.
//
// Test jedzie na atrapie puli — nic nie trafia do bazy.

const test = require("node:test");
const assert = require("node:assert");

const recalculateMatchPoints = require("../services/recalculateMatchPoints.js");

const GUILD_ID = "111";
const EVENT_ID = 42;
const MATCH_ID = 7;

// Atrapa puli. `wyniki` mówi, co odpowiedzieć na kolejne SELECT-y; wszystko,
// co nie jest wprost podane, wraca puste.
function utworzPule({ wynikSerii = [], typySerii = [] } = {}) {
  const zapytania = [];

  const pool = {
    async query(sql, params) {
      const tekst = String(sql);

      zapytania.push({ sql: tekst, params });

      if (/FROM match_results/i.test(tekst)) {
        return [wynikSerii, []];
      }

      if (/FROM match_predictions/i.test(tekst)) {
        return [typySerii, []];
      }

      return [[], []];
    },
    async getConnection() {
      return {
        query: pool.query,
        release() {},
      };
    },
  };

  return { pool, zapytania };
}

function wstawieniaDoPunktow(zapytania) {
  return zapytania.filter((z) => /INSERT INTO match_points/i.test(z.sql));
}

function kasowaniaPunktow(zapytania) {
  return zapytania.filter((z) => /DELETE FROM match_points/i.test(z.sql));
}

test("mecz bez wyniku nie dostaje żadnych wierszy punktowych", async () => {
  const { pool, zapytania } = utworzPule({
    // Brak wiersza w match_results...
    wynikSerii: [],
    // ...mimo że trzej gracze wytypowali ten mecz.
    typySerii: [
      { user_id: "a", pred_a: 2, pred_b: 0 },
      { user_id: "b", pred_a: 0, pred_b: 2 },
      { user_id: "c", pred_a: 2, pred_b: 1 },
    ],
  });

  await recalculateMatchPoints(pool, GUILD_ID, EVENT_ID, MATCH_ID, 3);

  const wstawienia = wstawieniaDoPunktow(zapytania);

  assert.strictEqual(
    wstawienia.length,
    0,
    "zapisano punkty za mecz, ktory nie ma wyniku - to wlasnie sa te zera",
  );
});

test("mecz bez wyniku czyści swoje wcześniejsze punkty", async () => {
  const { pool, zapytania } = utworzPule({ wynikSerii: [] });

  await recalculateMatchPoints(pool, GUILD_ID, EVENT_ID, MATCH_ID, 3);

  const kasowania = kasowaniaPunktow(zapytania);

  // Tą samą ścieżką idzie cofnięcie wyniku, więc punkty za mecz muszą zniknąć.
  assert.strictEqual(
    kasowania.length,
    1,
    "brak kasowania punktow meczu bez wyniku - cofniecie wyniku zostawiloby " +
      "punkty, ktorych juz nic nie pokrywa",
  );

  assert.deepStrictEqual(kasowania[0].params, [GUILD_ID, EVENT_ID, MATCH_ID]);
});

test("mecz z wynikiem punktuje normalnie", async () => {
  const { pool, zapytania } = utworzPule({
    wynikSerii: [{ res_a: 2, res_b: 0, exact_a: null, exact_b: null }],
    typySerii: [
      // Trafiony zwycięzca -> 2 pkt.
      { user_id: "a", pred_a: 2, pred_b: 0 },
      // Pudło -> 0 pkt, ale wiersz ma powstać: mecz JEST rozliczony.
      { user_id: "b", pred_a: 0, pred_b: 2 },
    ],
  });

  await recalculateMatchPoints(pool, GUILD_ID, EVENT_ID, MATCH_ID, 3);

  const wstawienia = wstawieniaDoPunktow(zapytania);

  assert.strictEqual(wstawienia.length, 1, "brak zapisu punktow");

  const wiersze = wstawienia[0].params[0];

  const serie = wiersze.filter((w) => w[5] === "series");

  const punkty = new Map(serie.map((w) => [w[3], w[4]]));

  assert.strictEqual(punkty.get("a"), 2, "trafiony zwyciezca to 2 pkt");
  assert.strictEqual(punkty.get("b"), 0, "pudlo to 0 pkt, ale wiersz istnieje");
});
