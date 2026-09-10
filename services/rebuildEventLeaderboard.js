// services/rebuildEventLeaderboard.js
//
// Jedno miejsce, w którym powstaje tabela `leaderboard`.
//
// Dlaczego akurat ta tabela jest kanonem klasyfikacji: tylko ona przeżywa
// "zakończ turniej" z opcją cleanup. Tamten krok kasuje *_predictions,
// *_results, *_scores, match_points i matches, a zostawia `leaderboard`
// i `mvp_scores`. Każdy ranking liczony na żywo z tabel składowych pokaże
// więc pusto dla zamkniętego turnieju - dlatego endpointy WWW czytają
// `leaderboard`, a nie sumują źródła same z siebie.
//
// Wcześniej przebudowę robił wyłącznie calculateScores (pełny przebieg).
// recalculateMatchPoints - wołane po KAŻDYM wpisanym wyniku meczu -
// odświeżało tylko match_points, więc `leaderboard` zostawał z poprzedniego
// pełnego przeliczenia i ekrany czytające jedno albo drugie rozjeżdżały się
// natychmiast po wyniku, aż ktoś kliknął "Przelicz punkty".

// user_id bywa w różnych kolacjach zależnie od tabeli (część powstała jako
// utf8mb4_unicode_ci, część jako utf8mb4_0900_ai_ci), a UNION ALL na
// niezgodnych kolacjach rzuca ER_CANT_AGGREGATE_2COLLATIONS. Sprowadzamy
// wszystkie gałęzie do jednej kolacji.
const USER_ID = `CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci`;

const SOURCES = [
  "swiss_scores",
  "playoffs_scores",
  "doubleelim_scores",
  "playin_scores",
  "match_points",
  "mvp_scores",
];

const UNION_SQL = SOURCES.map(
  (table) => `
      SELECT ${USER_ID} AS user_id, points
      FROM ${table}
      WHERE guild_id = ? AND event_id = ?`,
).join("\n      UNION ALL\n");

/**
 * Przelicza wiersze `leaderboard` dla jednego eventu.
 *
 * @param {object} conn pool albo połączenie w transakcji
 * @returns {Promise<{skipped: boolean, reason?: string, rows?: number}>}
 */
module.exports = async function rebuildEventLeaderboard(
  conn,
  guildId,
  eventId,
) {
  if (!guildId || !eventId) {
    return { skipped: true, reason: "MISSING_IDS" };
  }

  // Zarchiwizowanego turnieju nie ruszamy. Po cleanupie tabele składowe są
  // puste, więc przebudowa skasowałaby gotową klasyfikację końcową i
  // zostawiła pustą - a to jedyna kopia, jaka po tym turnieju została.
  const [[event]] = await conn.query(
    "SELECT is_archived FROM events WHERE id = ? AND guild_id = ? LIMIT 1",
    [eventId, guildId],
  );

  if (event && Number(event.is_archived) === 1) {
    return { skipped: true, reason: "EVENT_ARCHIVED" };
  }

  const params = [];
  for (let i = 0; i < SOURCES.length; i += 1) {
    params.push(guildId, eventId);
  }

  const [rows] = await conn.query(
    `
    SELECT user_id, SUM(points) AS total_points
    FROM (
${UNION_SQL}
    ) all_points
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    `,
    params,
  );

  await conn.query(
    "DELETE FROM leaderboard WHERE guild_id = ? AND event_id = ?",
    [guildId, eventId],
  );

  if (!rows.length) {
    return { skipped: false, rows: 0 };
  }

  await conn.query(
    `
    INSERT INTO leaderboard
      (guild_id, event_id, user_id, total_points)
    VALUES ?
    `,
    [rows.map((r) => [guildId, eventId, r.user_id, r.total_points])],
  );

  return { skipped: false, rows: rows.length };
};

module.exports.SOURCES = SOURCES;
