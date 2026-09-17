import { buildDuel } from "../lib/headToHead.js";

// Pojedynek dwóch graczy: wyłącznie mecze, które obaj obstawili.
//
// Trasa jest CELOWO wąska. Nazwy, awatary, serie, rekordy i miejsce w
// rankingu oddaje już profil gracza, a strona porównania i tak pobiera oba
// profile - powtórzenie tamtej logiki tutaj znaczyłoby drugi zestaw zapytań
// liczących to samo, który z czasem rozjedzie się z pierwszym.

export function registerHeadToHeadRoutes(app, { pool }) {
  app.get(
    "/api/public/events/:slug/head-to-head/:userA/:userB",
    async (req, res) => {
      try {
        const { slug, userA, userB } = req.params;

        if (String(userA) === String(userB)) {
          return res.status(400).json({
            error: "Do porównania potrzeba dwóch różnych graczy.",
            code: "server.needTwoPlayers",
          });
        }

        const [[event]] = await pool.query(
          `
        SELECT id, name, slug
        FROM events
        WHERE slug = ?
        LIMIT 1
        `,
          [slug],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        // Złączenie match_predictions z samą sobą daje dokładnie część
        // wspólną: wiersz powstaje tylko wtedy, gdy OBAJ mają typ na ten
        // sam mecz. Nie trzeba więc niczego odsiewać w JS-ie.
        //
        // Punkty idą przez podzapytania z GROUP BY, bo match_points ma na
        // jeden mecz kilka wierszy (seria i mapy osobno). Zwykły JOIN
        // zwielokrotniłby przez to wiersze meczów.
        const [rows] = await pool.query(
          `
        SELECT
          m.id        AS match_id,
          m.team_a,
          m.team_b,
          m.best_of,

          mr.res_a,
          mr.res_b,

          pa.pred_a   AS a_pred_a,
          pa.pred_b   AS a_pred_b,
          pb.pred_a   AS b_pred_a,
          pb.pred_b   AS b_pred_b,

          COALESCE(ptsa.points, 0) AS a_points,
          COALESCE(ptsb.points, 0) AS b_points

        FROM match_predictions pa

        INNER JOIN match_predictions pb
          ON pb.event_id = pa.event_id
         AND pb.match_id = pa.match_id
         AND pb.user_id  = ?

        INNER JOIN matches m
          ON m.id       = pa.match_id
         AND m.event_id = pa.event_id

        LEFT JOIN match_results mr
          ON mr.event_id = pa.event_id
         AND mr.match_id = pa.match_id

        LEFT JOIN (
          SELECT match_id, SUM(points) AS points
          FROM match_points
          WHERE event_id = ? AND user_id = ?
          GROUP BY match_id
        ) ptsa
          ON ptsa.match_id = pa.match_id

        LEFT JOIN (
          SELECT match_id, SUM(points) AS points
          FROM match_points
          WHERE event_id = ? AND user_id = ?
          GROUP BY match_id
        ) ptsb
          ON ptsb.match_id = pa.match_id

        WHERE pa.event_id = ?
          AND pa.user_id  = ?

        ORDER BY m.id DESC
        `,
          [
            userB,
            event.id,
            userA,
            event.id,
            userB,
            event.id,
            userA,
          ],
        );

        const { matches, summary } = buildDuel(rows);

        return res.json({
          event: {
            id: event.id,
            name: event.name,
            slug: event.slug,
          },

          user_a: userA,
          user_b: userB,

          summary,
          matches,
        });
      } catch (err) {
        console.error("HEAD TO HEAD ERROR:", err);

        return res.status(500).json({
          error: "Nie udało się wczytać porównania.",
          code: "server.h2hFailed",
        });
      }
    },
  );
}
