// Zapytanie o mecze razem ze stanem typowania zalogowanego gracza.
//
// KONTRAKT PARAMETROW: szablon ma trzy znaki zapytania na user_id - w CASE
// rozstrzygajacym "empty", w zlaczeniu match_predictions i w zlaczeniu
// match_map_predictions - i dopiero po nich ida parametry warunku. Wolajacy
// przekazuje wiec [userId, userId, userId, ...parametry warunku]. Dodanie
// czwartego ? w szablonie po cichu przesuwa wszystkim parametry, dlatego ich
// liczbe pilnuje test.
//
// `condition` trafia do zapytania przez interpolacje, a nie jako parametr, bo
// to fragment SQL-a. Obaj wolajacy podaja literal ("m.id = ?", "m.event_id = ?")
// i tak ma zostac - wartosci zawsze ida przez ?, nigdy przez ten argument.

// ======================================================
// MECZ + STAN TYPOWANIA - WSPOLNE DLA LISTY I POJEDYNCZEGO MECZU
// ======================================================
//
// Strona meczu na WWW pobierala CALA liste meczow turnieju i wyszukiwala
// w niej jeden po id, bo nie bylo publicznego endpointu pojedynczego meczu
// (/api/matches/:matchId jest adminowy). Przy 4 meczach to niewidoczne,
// przy 106 - kazde wejscie w mecz i kazde odswiezenie po zdarzeniu realtime
// ciagnie pelna liste razem z per-meczowa kontrola deadline'u.
//
// Zapytanie i wyliczanie stanu siedza tutaj, zeby lista i pojedynczy mecz
// nie mogly sie rozjechac - inaczej mecz otwarty na liscie moglby byc
// zablokowany na swojej stronie albo odwrotnie.

export function buildMatchesWithPickSql(condition) {
  return `
      SELECT
        m.id,
        m.event_id,
        m.guild_id,
        m.phase,
        m.match_no,
        m.team_a,
        m.team_b,
        m.best_of,
        m.start_time_utc,
        m.is_locked,
        m.lock_override,

        mp.pred_a,
        mp.pred_b,
        mp.pred_exact_a,
        mp.pred_exact_b,

        COALESCE(mmp.saved_maps, 0) AS saved_maps,

        CASE
          WHEN mr.match_id IS NOT NULL THEN 'FINAL'
          WHEN m.lock_override = 1 THEN 'LOCKED'
          WHEN m.lock_override = 0 THEN 'OPEN'
          WHEN m.is_locked = 1 THEN 'LOCKED'
          ELSE 'OPEN'
        END AS ui_status,

        CASE
          WHEN ? IS NULL THEN 'empty'

          WHEN m.best_of = 1
            AND mp.match_id IS NOT NULL
            AND mp.pred_exact_a IS NOT NULL
            AND mp.pred_exact_b IS NOT NULL
          THEN 'complete'

          WHEN m.best_of > 1
            AND mp.match_id IS NOT NULL
            AND COALESCE(mmp.saved_maps, 0) >= (mp.pred_a + mp.pred_b)
          THEN 'complete'

          WHEN mp.match_id IS NOT NULL
            OR COALESCE(mmp.saved_maps, 0) > 0
          THEN 'partial'

          ELSE 'empty'
        END AS prediction_status

      FROM matches m

      LEFT JOIN match_results mr
        ON mr.match_id = m.id
       AND mr.event_id = m.event_id
       AND mr.guild_id = m.guild_id

      LEFT JOIN match_predictions mp
        ON mp.guild_id = m.guild_id
       AND mp.event_id = m.event_id
       AND mp.match_id = m.id
       AND mp.user_id = ?

      LEFT JOIN (
        SELECT
          guild_id,
          event_id,
          match_id,
          user_id,
          COUNT(*) AS saved_maps
        FROM match_map_predictions
        GROUP BY
          guild_id,
          event_id,
          match_id,
          user_id
      ) mmp
        ON mmp.guild_id = m.guild_id
       AND mmp.event_id = m.event_id
       AND mmp.match_id = m.id
       AND mmp.user_id = ?

      WHERE ${condition}

      ORDER BY
        m.match_no ASC,
        m.id ASC
      `;
}
