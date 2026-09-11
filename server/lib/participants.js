// Zapytania o uczestnikow eventu: ilu ich jest i jak sie nazywaja.
//
// Wyladowaly w lib/, bo przy rozbijaniu app.js okazalo sie, ze sa uzywane po
// obu stronach podzialu - i w trasach eventu, i w profilu gracza.
//
// Oba zapytania robia CAST(... AS CHAR CHARACTER SET utf8mb4) COLLATE ... w
// KAZDEJ galezi UNION. To nie jest ozdoba: user_id ma rozne kolacje w roznych
// tabelach (utf8mb4_0900_ai_ci w leaderboard, utf8mb4_unicode_ci w tabelach
// faz) i bez wyrownania MySQL wywala ER_CANT_AGGREGATE_NCOLLATIONS.
//
// Aliasy SQL zostawione po polsku - to jezyk zapytania, a nie nazewnictwo kodu,
// i ich zmiana byla by ryzykiem bez zysku.

export function createParticipantQueries(pool) {
  // w roznych tabelach i inaczej leci ER_CANT_AGGREGATE_NCOLLATIONS.
  //
  // Nazwa gracza zapamietana przy typowaniu.
  //
  // user_profiles ma row tylko dla osob, ktore logowaly sie na stronie.
  // Kto typowal wylacznie z Discorda, tam go nie ma - i bez tego zapasu
  // zamiast nicku wychodzi surowe user_id. Tabele faz zapisuja nazwe razem
  // z typem i przezywaja archiwizacje turnieju.
  //
  // Tu chodzi o jednego gracza, wiec kazda galaz ma LIMIT 1 - w rankingu
  // to samo robi zlaczenie po calej liscie.
  async function findNameFromPicks(eventId, userId) {
    const TABLES = [
      "swiss_predictions",
      "swiss_scores",
      "playoffs_predictions",
      "playoffs_scores",
      "playin_predictions",
      "playin_scores",
      "doubleelim_predictions",
      "doubleelim_scores",
    ];

    // Kazda galaz w nawiasach - bez nich MySQL nie przyjmuje LIMIT wewnatrz
    // skladnika UNION i wywala blad skladni.
    const branches = TABLES.map(
      (table) => `
        (SELECT CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
                  COLLATE utf8mb4_unicode_ci AS nazwa
           FROM \`${table}\`
          WHERE event_id = ?
            AND CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci = ?
            AND COALESCE(displayname, username) IS NOT NULL
          LIMIT 1)`,
    ).join(" UNION ALL ");

    const params = [];

    for (const _ of TABLES) params.push(eventId, String(userId));

    const [rows] = await pool.query(
      `SELECT nazwa FROM ( ${branches} ) zrodla WHERE nazwa IS NOT NULL LIMIT 1`,
      params,
    );

    return rows[0]?.nazwa || null;
  }

  async function countParticipants(eventId) {
    const [[row]] = await pool.query(
      `
      SELECT COUNT(DISTINCT user_id) AS uczestnicy
      FROM (
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM match_predictions WHERE event_id = ?
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM swiss_predictions WHERE event_id = ?
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playoffs_predictions WHERE event_id = ?
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playin_predictions WHERE event_id = ?
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM doubleelim_predictions WHERE event_id = ?
      ) typujacy
      `,
      [eventId, eventId, eventId, eventId, eventId],
    );

    return Number(row?.uczestnicy || 0);
  }

  return { findNameFromPicks, countParticipants };
}
