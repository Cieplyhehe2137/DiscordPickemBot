// Wlasne typy zalogowanego gracza: typy fazy i punkty za pojedynczy mecz.
//
// Dwie trasy tylko do odczytu, obie odpowiadaja na pytanie "co ja
// wytypowalem i ile z tego mam".

export function registerMyPicksRoutes(
  app,
  {
    isGuildMember,
    pool,
  },
) {
  app.get("/api/public/events/:slug/my-predictions/:phase", async (req, res) => {
    try {
      const userId = req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
        });
      }

      const { slug, phase } = req.params;

      const page = Math.max(0, Number(req.query.page) || 0);

      const PAGE_SIZE = 5;

      const [[event]] = await pool.query(
        `
          SELECT
            id,
            guild_id,
            name,
            slug
          FROM events
          WHERE slug = ?
          LIMIT 1
          `,
        [slug],
      );

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
        });
      }

      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      const [[countRow]] = await pool.query(
        `
          SELECT COUNT(*) AS total
          FROM matches
          WHERE guild_id = ?
            AND event_id = ?
            AND phase = ?
          `,
        [event.guild_id, event.id, phase],
      );

      const totalMatches = Number(countRow?.total || 0);

      const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));

      const safePage = Math.min(page, totalPages - 1);

      const offset = safePage * PAGE_SIZE;

      const [matches] = await pool.query(
        `
          SELECT
            m.id,
            m.match_no,
            m.team_a,
            m.team_b,
            m.best_of,

            mp.pred_a,
            mp.pred_b,
            mp.pred_exact_a,
            mp.pred_exact_b,

            mr.res_a,
            mr.res_b,

            COALESCE(points.series_points, 0) AS series_points,
            COALESCE(points.map_points, 0) AS map_points,
            COALESCE(points.total_points, 0) AS earned_points,

            CASE
              WHEN mr.match_id IS NOT NULL THEN 1
              ELSE 0
            END AS has_result

          FROM matches m

          LEFT JOIN match_predictions mp
            ON mp.guild_id = m.guild_id
           AND mp.event_id = m.event_id
           AND mp.match_id = m.id
           AND mp.user_id = ?

          LEFT JOIN match_results mr
            ON mr.guild_id = m.guild_id
           AND mr.event_id = m.event_id
           AND mr.match_id = m.id

          LEFT JOIN (
            SELECT
              guild_id,
              event_id,
              match_id,
              user_id,

              SUM(
                CASE
                  WHEN source = 'series' THEN points
                  ELSE 0
                END
              ) AS series_points,

              SUM(
                CASE
                  WHEN source = 'map' THEN points
                  ELSE 0
                END
              ) AS map_points,

              SUM(points) AS total_points

            FROM match_points

            GROUP BY
              guild_id,
              event_id,
              match_id,
              user_id
          ) points
            ON points.guild_id = m.guild_id
           AND points.event_id = m.event_id
           AND points.match_id = m.id
           AND points.user_id = ?

          WHERE m.guild_id = ?
            AND m.event_id = ?
            AND m.phase = ?

          ORDER BY
            COALESCE(m.match_no, 999999),
            m.id

          LIMIT ? OFFSET ?
          `,
        [userId, userId, event.guild_id, event.id, phase, PAGE_SIZE, offset],
      );

      const matchIds = matches.map((match) => Number(match.id));

      let maps = [];

      if (matchIds.length) {
        const placeholders = matchIds.map(() => "?").join(", ");

        const [mapRows] = await pool.query(
          `
            SELECT
              p.match_id,
              p.map_no,
              p.pred_exact_a,
              p.pred_exact_b,

              r.exact_a AS res_exact_a,
              r.exact_b AS res_exact_b

            FROM match_map_predictions p

            LEFT JOIN match_map_results r
              ON r.guild_id = p.guild_id
             AND r.event_id = p.event_id
             AND r.match_id = p.match_id
             AND r.map_no = p.map_no

            WHERE p.guild_id = ?
              AND p.event_id = ?
              AND p.user_id = ?
              AND p.match_id IN (${placeholders})

            ORDER BY
              p.match_id,
              p.map_no
            `,
          [event.guild_id, event.id, userId, ...matchIds],
        );

        maps = mapRows;
      }

      const mapsByMatch = new Map();

      for (const map of maps) {
        const key = Number(map.match_id);

        if (!mapsByMatch.has(key)) {
          mapsByMatch.set(key, []);
        }

        mapsByMatch.get(key).push({
          map_no: Number(map.map_no),

          pred_exact_a:
            map.pred_exact_a !== null ? Number(map.pred_exact_a) : null,

          pred_exact_b:
            map.pred_exact_b !== null ? Number(map.pred_exact_b) : null,

          res_exact_a: map.res_exact_a !== null ? Number(map.res_exact_a) : null,

          res_exact_b: map.res_exact_b !== null ? Number(map.res_exact_b) : null,
        });
      }

      res.json({
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
        },

        phase,

        pagination: {
          page: safePage,
          page_size: PAGE_SIZE,
          total_matches: totalMatches,
          total_pages: totalPages,
        },

        matches: matches.map((match) => ({
          id: Number(match.id),
          match_no: match.match_no !== null ? Number(match.match_no) : null,

          team_a: match.team_a,
          team_b: match.team_b,

          best_of: Number(match.best_of),

          prediction:
            match.pred_a !== null && match.pred_b !== null
              ? {
                pred_a: Number(match.pred_a),
                pred_b: Number(match.pred_b),

                pred_exact_a:
                  match.pred_exact_a !== null
                    ? Number(match.pred_exact_a)
                    : null,

                pred_exact_b:
                  match.pred_exact_b !== null
                    ? Number(match.pred_exact_b)
                    : null,
              }
              : null,

          result:
            Number(match.has_result) === 1
              ? {
                res_a: Number(match.res_a),
                res_b: Number(match.res_b),
              }
              : null,

          points: {
            series: Number(match.series_points || 0),

            maps: Number(match.map_points || 0),

            total: Number(match.earned_points || 0),
          },

          maps: mapsByMatch.get(Number(match.id)) || [],
        })),
      });
    } catch (err) {
      console.error("MY PREDICTIONS ERROR:", err);

      res.status(500).json({
        error: "Nie udało się wczytać Twoich typów.",
      });
    }
  });


  app.get("/api/public/matches/:matchId/my-points", async (req, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
        });
      }

      const [[match]] = await pool.query(
        `
        SELECT
          id,
          guild_id,
          event_id
        FROM matches
        WHERE id = ?
        LIMIT 1
        `,
        [matchId],
      );

      if (!match) {
        return res.status(404).json({
          error: "Nie znaleziono meczu.",
        });
      }

      if (!isGuildMember(req.session.user, match.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      const [[row]] = await pool.query(
        `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN source = 'series' THEN points
                ELSE 0
              END
            ),
            0
          ) AS series_points,

          COALESCE(
            SUM(
              CASE
                WHEN source = 'map' THEN points
                ELSE 0
              END
            ),
            0
          ) AS map_points,

          COALESCE(
            SUM(points),
            0
          ) AS total_points

        FROM match_points
        WHERE guild_id = ?
          AND event_id = ?
          AND match_id = ?
          AND user_id = ?
        `,
        [
          match.guild_id,
          match.event_id,
          match.id,
          userId,
        ],
      );

      return res.json({
        points: {
          series: Number(row?.series_points || 0),
          maps: Number(row?.map_points || 0),
          total: Number(row?.total_points || 0),
        },
      });
    } catch (err) {
      console.error("MY MATCH POINTS ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać punktów.",
      });
    }
  });
}
