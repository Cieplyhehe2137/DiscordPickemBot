import { buildUserAudit } from "../lib/userAudit.js";

// Wyszukiwarka graczy i audyt jednego gracza — dla panelu administratora.
//
// PO CO, SKORO JEST PUBLICZNY PROFIL. Profil pokazuje prawie wszystko, ale
// dwie rzeczy, bez których audyt sprowadza się do grzebania w bazie, są poza
// jego zasięgiem:
//
//  1. Historia meczów jest tam ucięta do DZIESIĘCIU ostatnich. Czołowy gracz
//     Kolonii ma 106 typów, czyli widać 9% jego wyborów.
//
//  2. Nie da się znaleźć człowieka, nie wiedząc, w którym turnieju grał.
//     Wyszukiwarka rankingu szuka w JEDNYM turnieju i tylko wśród tych,
//     którzy mają wiersz w klasyfikacji.
//
// Reszta - punkty, miejsce, skuteczność, typy na fazy - NIE jest tu liczona
// od nowa. Panel dociąga ją z tej samej trasy, co strona publiczna, żeby
// audyt nie mógł pokazać innej prawdy niż to, co widzi gracz.
//
// ZAKRES UPRAWNIEŃ. Obie trasy stoją za requireGuildAdmin rozwiązywanym
// z turnieju w adresie, więc administrator jednego serwera nie przegląda
// graczy drugiego. Serwis obsługuje dwie społeczności i to nie jest
// teoretyczne.
//
// SZUKANIE PO STRONIE JS, nie w SQL-u. Guild ma dziś rzędu tysiąca graczy,
// więc filtr w pamięci kosztuje tyle co nic, a w zamian jedno zapytanie
// obsługuje wszystkie warianty frazy: fragment nicku, fragment nazwy
// użytkownika i fragment identyfikatora. LIKE po trzech kolumnach z różnymi
// kolacjami dawałby to samo znacznie mniejszym kosztem czytelności.

/** Ile wyników wyszukiwania oddajemy. */
const LIMIT_WYNIKOW = 25;

/** Poniżej tylu znaków nie szukamy - jedna litera to pół listy graczy. */
const MIN_ZNAKOW = 2;

// Nazwy graczy leżą w tabelach faz razem z typem i przeżywają archiwizację
// turnieju. user_profiles ma wiersz tylko dla osób, które logowały się na
// stronie - kto typował wyłącznie z Discorda, tam go nie ma.
const TABELE_NAZW = [
  "swiss_predictions",
  "swiss_scores",
  "playoffs_predictions",
  "playoffs_scores",
  "playin_predictions",
  "playin_scores",
  "doubleelim_predictions",
  "doubleelim_scores",
];

// user_id ma różne kolacje w różnych tabelach (utf8mb4_0900_ai_ci
// w leaderboard, utf8mb4_unicode_ci w tabelach faz) - bez wyrównania MySQL
// wywala ER_CANT_AGGREGATE_NCOLLATIONS.
const UID = "CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci";

// To samo dotyczy guild_id: events.guild_id ma inną kolację niż tabele faz,
// więc gołe `guild_id = (SELECT guild_id FROM events ...)` kończy się
// ER_CANT_AGGREGATE_2COLLATIONS. Wyszło na uruchomieniu zapytania na
// produkcyjnej bazie, nie przy czytaniu kodu.
const GID = "CAST(guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci";

/** Serwer, do którego należy turniej z adresu. */
const GUILD_Z_SLUGA = `(SELECT ${GID} FROM events WHERE slug = ? LIMIT 1)`;

function normalizuj(tekst) {
  return String(tekst ?? "").trim().toLowerCase();
}

export function registerAdminUserRoutes(app, { pool, requireGuildAdmin, guildIdFromEventSlug }) {
  /**
   * Wyszukiwarka graczy w obrębie SERWERA, do którego należy turniej.
   *
   * Nie w obrębie turnieju: audyt zaczyna się od „znajdź mi tego człowieka",
   * a pytający zwykle nie wie, w którym turnieju szukać.
   */
  app.get(
    "/api/events/:slug/admin/users",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const fraza = normalizuj(req.query.szukaj);

        if (fraza.length < MIN_ZNAKOW) {
          return res.json({ users: [], fraza: null, minZnakow: MIN_ZNAKOW });
        }

        const { slug } = req.params;

        // Wszystkie znane nazwy w tym serwerze, jedną falą.
        //
        // Gałąź z user_profiles dokłada osoby, które logowały się na stronie,
        // ale nigdy nie typowały - i o nie też ktoś może pytać.
        const galezieFaz = TABELE_NAZW.map(
          (tabela) => `
            SELECT ${UID} AS user_id,
                   CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS nazwa,
                   CAST(username AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS username
              FROM \`${tabela}\`
             WHERE ${GID} = ${GUILD_Z_SLUGA}`,
        ).join(" UNION ALL ");

        const parametry = TABELE_NAZW.map(() => slug);

        const [wiersze] = await pool.query(
          `
          SELECT user_id, nazwa, username FROM (
            ${galezieFaz}

            UNION ALL

            SELECT ${UID} AS user_id,
                   CAST(up.displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
                   CAST(up.username AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
              FROM user_profiles up
             WHERE ${UID} IN (
               SELECT CAST(l.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
                 FROM leaderboard l
                WHERE CAST(l.guild_id AS CHAR CHARACTER SET utf8mb4)
                        COLLATE utf8mb4_unicode_ci = ${GUILD_Z_SLUGA}
             )
          ) zrodla
          `,
          [...parametry, slug],
        );

        // Jeden wiersz na gracza. Pierwsza napotkana nazwa wygrywa - tak samo
        // jak w findNameFromPicks, żeby panel i profil pokazały to samo.
        const poGraczu = new Map();

        for (const w of wiersze) {
          const id = String(w.user_id ?? "");

          if (!id) continue;

          const wpis = poGraczu.get(id) ?? { user_id: id, displayname: null, username: null };

          if (!wpis.displayname && w.nazwa) wpis.displayname = w.nazwa;
          if (!wpis.username && w.username) wpis.username = w.username;

          poGraczu.set(id, wpis);
        }

        const pasuje = (g) =>
          g.user_id.includes(fraza) ||
          normalizuj(g.displayname).includes(fraza) ||
          normalizuj(g.username).includes(fraza);

        const znalezione = [...poGraczu.values()].filter(pasuje);

        // Kolejność: najpierw dokładne trafienie w identyfikator, potem
        // alfabetycznie. Bez tego wpisanie pełnego ID potrafiło dać ten
        // wiersz na końcu listy.
        znalezione.sort((a, b) => {
          const aId = a.user_id === fraza ? 0 : 1;
          const bId = b.user_id === fraza ? 0 : 1;

          if (aId !== bId) return aId - bId;

          return String(a.displayname || a.user_id).localeCompare(
            String(b.displayname || b.user_id),
          );
        });

        res.json({
          users: znalezione.slice(0, LIMIT_WYNIKOW),
          znalezionych: znalezione.length,
          fraza: req.query.szukaj,
          minZnakow: MIN_ZNAKOW,
        });
      } catch (err) {
        console.error("ADMIN USER SEARCH ERROR:", err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );

  /**
   * Komplet typów jednego gracza w jednym turnieju.
   *
   * Wszystko idzie JEDNĄ FALĄ - żadne z tych zapytań nie potrzebuje wyniku
   * pozostałych, a każda podróż do bazy kosztuje na produkcji około 177 ms.
   */
  app.get(
    "/api/events/:slug/admin/users/:userId",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug, userId } = req.params;

        const zdarzenie = "(SELECT id FROM events WHERE slug = ? LIMIT 1)";

        const [
          [[event]],
          [matches],
          [predictions],
          [results],
          [mapPicks],
          [mapResults],
          [points],
        ] = await Promise.all([
          pool.query(
            "SELECT id, name, slug FROM events WHERE slug = ? LIMIT 1",
            [slug],
          ),

          pool.query(
            `SELECT id, match_no, phase, team_a, team_b, best_of
               FROM matches
              WHERE event_id = ${zdarzenie}
              ORDER BY match_no, id`,
            [slug],
          ),

          pool.query(
            `SELECT match_id, pred_a, pred_b
               FROM match_predictions
              WHERE event_id = ${zdarzenie} AND ${UID} = ?`,
            [slug, String(userId)],
          ),

          pool.query(
            `SELECT match_id, res_a, res_b
               FROM match_results
              WHERE event_id = ${zdarzenie}`,
            [slug],
          ),

          pool.query(
            `SELECT match_id, map_no, pred_exact_a, pred_exact_b
               FROM match_map_predictions
              WHERE event_id = ${zdarzenie} AND ${UID} = ?`,
            [slug, String(userId)],
          ),

          pool.query(
            `SELECT match_id, map_no, exact_a, exact_b
               FROM match_map_results
              WHERE event_id = ${zdarzenie}`,
            [slug],
          ),

          pool.query(
            `SELECT match_id, source, points
               FROM match_points
              WHERE event_id = ${zdarzenie} AND ${UID} = ?`,
            [slug, String(userId)],
          ),
        ]);

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        const audyt = buildUserAudit({
          matches,
          predictions,
          results,
          mapPicks,
          mapResults,
          points,
        });

        res.json({
          event: { id: event.id, name: event.name, slug: event.slug },
          user_id: String(userId),
          ...audyt,
        });
      } catch (err) {
        console.error("ADMIN USER AUDIT ERROR:", err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );
}
