// Szablon zapytania o mecze ze stanem typowania.
//
// SQL-a nie da sie tu wykonac bez bazy, wiec testy pilnuja tego, co da sie
// sprawdzic ze struktury tekstu - i akurat to jest ta czesc, ktora psuje sie po
// cichu. Liczba znakow zapytania jest kontraktem: wolajacy przekazuje
// [userId, userId, userId, ...parametry warunku], wiec dolozenie czwartego ?
// w szablonie przesuwa wszystkim parametry i zapytanie zaczyna odpowiadac na
// inne pytanie, zamiast wywalic sie z bledem.

const test = require("node:test");
const assert = require("node:assert/strict");

const MATCH_QUERIES = "../server/lib/matchQueries.js";

function liczZnakiZapytania(sql) {
  return (sql.match(/\?/g) || []).length;
}

test("szablon ma dokladnie trzy parametry na user_id przed warunkiem", async () => {
  const { buildMatchesWithPickSql } = await import(MATCH_QUERIES);

  // Warunek bez wlasnego ? - wszystko, co zostaje, nalezy do szablonu.
  const sql = buildMatchesWithPickSql("m.id = 1");

  assert.equal(
    liczZnakiZapytania(sql),
    3,
    "trzy ?: CASE rozstrzygajacy 'empty', zlaczenie typow i zlaczenie map",
  );
});

test("parametry warunku doliczaja sie do tych trzech", async () => {
  const { buildMatchesWithPickSql } = await import(MATCH_QUERIES);

  // Tak wola events.js i publicMatches.js - stad [userId, userId, userId, x].
  assert.equal(liczZnakiZapytania(buildMatchesWithPickSql("m.id = ?")), 4);
  assert.equal(liczZnakiZapytania(buildMatchesWithPickSql("m.event_id = ?")), 4);

  assert.equal(
    liczZnakiZapytania(buildMatchesWithPickSql("m.event_id = ? AND m.phase = ?")),
    5,
  );
});

test("warunek trafia do WHERE, a nie gdziekolwiek indziej", async () => {
  const { buildMatchesWithPickSql } = await import(MATCH_QUERIES);

  const sql = buildMatchesWithPickSql("m.event_id = ?");

  assert.match(sql, /WHERE\s+m\.event_id = \?/);

  // WHERE musi stac po zlaczeniach i przed sortowaniem - inaczej zapytanie
  // jest skladniowo bledne i wychodzi to dopiero na bazie.
  assert.ok(
    sql.indexOf("LEFT JOIN") < sql.indexOf("WHERE"),
    "WHERE po zlaczeniach",
  );
  assert.ok(sql.indexOf("WHERE") < sql.indexOf("ORDER BY"), "WHERE przed ORDER BY");
});

test("kolejnosc wynikow jest ustalona, a nie przypadkowa", async () => {
  const { buildMatchesWithPickSql } = await import(MATCH_QUERIES);

  const sql = buildMatchesWithPickSql("m.id = ?");

  // Bez ORDER BY MySQL nie obiecuje niczego, a lista meczow ma isc po numerze.
  assert.match(sql, /ORDER BY\s+m\.match_no ASC,\s+m\.id ASC/);
});

test("zapytanie zwraca pola, na ktorych stoi widok meczu", async () => {
  const { buildMatchesWithPickSql } = await import(MATCH_QUERIES);

  const sql = buildMatchesWithPickSql("m.id = ?");

  for (const kolumna of [
    "ui_status",
    "prediction_status",
    "saved_maps",
    "pred_exact_a",
    "lock_override",
  ]) {
    assert.ok(sql.includes(kolumna), `brakuje ${kolumna}`);
  }
});
