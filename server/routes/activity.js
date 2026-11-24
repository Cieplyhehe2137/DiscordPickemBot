// Ostatnia aktywnosc serwera dla panelu administratora.
//
// TYLKO DLA ADMINA. Lista niesie nick gracza i to, czego dotyczy typ. Dla
// wszystkich byloby to zdradzaniem tlumu przed zamknieciem typowania -
// czemu projekt celowo zapobiega w pick-stats.
//
// ZLACZENIA PO event_id, NIGDY PO guild_id. Kolumna guild_id ma w tej bazie
// trzy rozne kolacje (events w utf8mb4_0900_ai_ci, match_predictions
// i matches w utf8mb4_unicode_ci, playoffs_predictions samotnie
// w utf8mb4_general_ci), wiec porownanie kolumny z kolumna wywala sie na
// ER_CANT_AGGREGATE_2COLLATIONS. Porownanie kolumny z PARAMETREM jest
// bezpieczne, wiec kazde zapytanie filtruje po wlasnym guild_id i laczy sie
// z reszta po liczbowym event_id.

import { buildActivityFeed } from "../lib/activityFeed.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function registerActivityRoutes(app, { pool, requireGuildAdmin }) {
  // Brak tabeli to zero zdarzen danego rodzaju, nie blad calej listy -
  // schema.sql bywa niepelny wobec produkcji.
  async function query(sql, params) {
    try {
      const [rows] = await pool.query(sql, params);

      return rows;
    } catch (err) {
      if (err?.code === "ER_NO_SUCH_TABLE") return [];

      throw err;
    }
  }

  app.get(
    "/api/guilds/:guildId/activity",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;

        const limit = Math.min(
          MAX_LIMIT,
          Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT),
        );

        // Kazde zrodlo bierze wlasny limit: lista i tak przytnie calosc po
        // posortowaniu, a bez tego jedna tabela z tysiacami wierszy
        // przeslonilaby pozostale.
        const perSource = limit;

        const fazy = [
          ["swiss_predictions", "swissPick", true],
          ["playin_predictions", "playinPick", false],
          ["playoffs_predictions", "playoffsPick", false],
          ["doubleelim_predictions", "doubleelimPick", false],
        ];

        const [mecze, wyniki, mvp, ...faz] = await Promise.all([
          query(
            `
            SELECT 'matchPick' AS kind,
                   mp.updated_at AS at,
                   mp.user_id,
                   mp.match_id,
                   m.match_no,
                   m.team_a,
                   m.team_b,
                   m.phase,
                   e.slug AS event_slug,
                   e.name AS event_name
              FROM match_predictions mp
              JOIN matches m ON m.id = mp.match_id
              JOIN events e ON e.id = mp.event_id
             WHERE mp.guild_id = ?
               AND mp.updated_at IS NOT NULL
             ORDER BY mp.updated_at DESC
             LIMIT ?
            `,
            [guildId, perSource],
          ),

          query(
            `
            SELECT 'matchResult' AS kind,
                   mr.finished_at AS at,
                   NULL AS user_id,
                   mr.match_id,
                   m.match_no,
                   m.team_a,
                   m.team_b,
                   m.phase,
                   e.slug AS event_slug,
                   e.name AS event_name
              FROM match_results mr
              JOIN matches m ON m.id = mr.match_id
              JOIN events e ON e.id = mr.event_id
             WHERE mr.guild_id = ?
               AND mr.finished_at IS NOT NULL
             ORDER BY mr.finished_at DESC
             LIMIT ?
            `,
            [guildId, perSource],
          ),

          query(
            `
            SELECT 'mvpPick' AS kind,
                   COALESCE(mv.updated_at, mv.created_at) AS at,
                   mv.user_id,
                   mv.username,
                   e.slug AS event_slug,
                   e.name AS event_name
              FROM mvp_predictions mv
              JOIN events e ON e.id = mv.event_id
             WHERE mv.guild_id = ?
             ORDER BY COALESCE(mv.updated_at, mv.created_at) DESC
             LIMIT ?
            `,
            [guildId, perSource],
          ),

          ...fazy.map(([table, kind, withStage]) =>
            query(
              `
              SELECT '${kind}' AS kind,
                     p.submitted_at AS at,
                     p.user_id,
                     p.displayname,
                     p.username,
                     ${withStage ? "p.stage" : "NULL AS stage"},
                     e.slug AS event_slug,
                     e.name AS event_name
                FROM \`${table}\` p
                JOIN events e ON e.id = p.event_id
               WHERE p.guild_id = ?
                 AND p.submitted_at IS NOT NULL
               ORDER BY p.submitted_at DESC
               LIMIT ?
              `,
              [guildId, perSource],
            ),
          ),
        ]);

        const sources = [mecze, wyniki, mvp, ...faz];

        // Nazwy osobnym zapytaniem, a nie zlaczeniem: user_profiles ma
        // wlasna kolacje user_id, a porownanie kolumny z kolumna miedzy
        // tabelami jest w tej bazie polem minowym. Lista parametrow nie jest.
        const ids = [
          ...new Set(
            sources
              .flat()
              .map((r) => r?.user_id)
              .filter((x) => x !== null && x !== undefined)
              .map(String),
          ),
        ];

        const names = new Map();

        if (ids.length) {
          const profile = await query(
            `SELECT user_id, username, displayname
               FROM user_profiles
              WHERE user_id IN (${ids.map(() => "?").join(",")})`,
            ids,
          );

          for (const p of profile) {
            names.set(String(p.user_id), {
              username: p.username,
              displayname: p.displayname,
            });
          }
        }

        return res.json(buildActivityFeed({ sources, names, limit }));
      } catch (err) {
        console.error("ACTIVITY FEED:", err);

        return res.status(500).json({
          error: "Nie udało się pobrać ostatniej aktywności.",
          code: "server.activityFailed",
        });
      }
    },
  );
}
