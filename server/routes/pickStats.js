// Statystyki oddanych typow dla panelu administratora.
//
// DLACZEGO OSOBNA TRASA, A NIE ROZSZERZENIE /api/events/:slug/stats
//
// Tamta trasa NIE jest chroniona, mimo ze nie lezy pod /api/public/ -
// konsumuje ja publiczna strona turnieju. Dolozenie do niej podzialu glosow
// odslonilo by typy tlumu kazdemu graczowi w trakcie otwartego typowania,
// czyli dokladnie to, czemu zapobiega blokada w pick-stats ("Przed lockiem
// nie pokazujemy community stats"). Statystyki admina musza wiec miec wlasna
// trase za requireGuildAdmin.
//
// TURNIEJ SPRAWDZAMY PO slug I guild_id NARAZ. Slugi sa unikalne w obrebie
// serwera, nie globalnie, a serwis obsluguje kilka spolecznosci - samo
// `WHERE slug = ?` pozwoliloby adminowi jednego serwera przeczytac typy
// drugiego.

import { policzStatystykiTypow } from "../lib/pickStats.js";
import { teamKey } from "../lib/teamLogos.js";

export function registerPickStatsRoutes(app, { pool, requireGuildAdmin }) {
  /**
   * Zapytanie, ktore znosi brak tabeli.
   *
   * schema.sql w tym repozytorium bywa niepelny wobec produkcji (tak bylo
   * z event_teams i jest z team_logos), a kilka tabel z typami powstalo
   * migracjami. Brak tabeli to zero typow danej fazy, nie blad calej strony.
   */
  async function zapytaj(sql, parametry) {
    try {
      const [wiersze] = await pool.query(sql, parametry);

      return wiersze;
    } catch (err) {
      if (err?.code === "ER_NO_SUCH_TABLE") return [];

      throw err;
    }
  }

  app.get(
    "/api/guilds/:guildId/events/:slug/pick-stats",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId, slug } = req.params;

        const [[event]] = await pool.query(
          `
          SELECT id, slug, name, status, is_open, is_active, is_archived
          FROM events
          WHERE slug = ?
            AND guild_id = ?
          LIMIT 1
          `,
          [slug, guildId],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        const eventId = event.id;

        // OSIEM ZAPYTAN RAZEM, NIE PO KOLEI. Zadne nie potrzebuje wyniku
        // zadnego innego, a kazde to osobny obieg do bazy. Czekanie na nie
        // po kolei kosztowalo 2,1 s nawet dla turnieju z 172 typami, czyli
        // niemal wylacznie narzut, nie liczenie. Pula ma 10 polaczen, wiec
        // osiem naraz miesci sie bez kolejkowania.
        //
        // Pierwsze zapytanie o mecze jest potrzebne, bo match_predictions
        // trzyma wynik pred_a:pred_b, a nie nazwe wytypowanej druzyny - kto
        // zostal wskazany na zwyciezce wynika z ustawienia druzyn w meczu.
        const [
          mecze,
          typyMeczow,
          typyMap,
          typySwiss,
          typyPlayin,
          typyPlayoffs,
          typyDoubleElim,
          typyMvp,
        ] = await Promise.all([
          zapytaj(
            `
            SELECT id, team_a, team_b, best_of, phase
            FROM matches
            WHERE event_id = ?
              AND guild_id = ?
            `,
            [eventId, guildId],
          ),

          zapytaj(
            `
            SELECT user_id, match_id, pred_a, pred_b
            FROM match_predictions
            WHERE event_id = ?
              AND guild_id = ?
            `,
            [eventId, guildId],
          ),

          zapytaj(
            `
            SELECT user_id, match_id, map_no
            FROM match_map_predictions
            WHERE event_id = ?
              AND guild_id = ?
            `,
            [eventId, guildId],
          ),

          zapytaj(
            `
            SELECT user_id, pick_3_0, pick_0_3, advancing, stage
            FROM swiss_predictions
            WHERE event_id = ?
              AND guild_id = ?
            `,
            [eventId, guildId],
          ),

          zapytaj(
            `
            SELECT user_id, teams
            FROM playin_predictions
            WHERE event_id = ?
              AND guild_id = ?
            `,
            [eventId, guildId],
          ),

          zapytaj(
            `
            SELECT user_id, semifinalists, finalists, winner,
                   third_place_winner
            FROM playoffs_predictions
            WHERE event_id = ?
              AND guild_id = ?
            `,
            [eventId, guildId],
          ),

          zapytaj(
            `
            SELECT user_id, upper_final_a, upper_final_b,
                   lower_final_a, lower_final_b
            FROM doubleelim_predictions
            WHERE event_id = ?
              AND guild_id = ?
            `,
            [eventId, guildId],
          ),

          zapytaj(
            `
            SELECT user_id, candidate_id
            FROM mvp_predictions
            WHERE event_id = ?
              AND guild_id = ?
            `,
            [eventId, guildId],
          ),
        ]);

        const statystyki = policzStatystykiTypow({
          mecze,
          typyMeczow,
          typyMap,
          typySwiss,
          typyPlayin,
          typyPlayoffs,
          typyDoubleElim,
          typyMvp,
          teamKey,
        });

        // Typowanie otwarte znaczy, ze te liczby jeszcze rosna - panel ma to
        // powiedziec, bo inaczej wyglada jak wynik koncowy.
        const otwarte =
          String(event.status) === "OPEN" &&
          Number(event.is_open) === 1 &&
          Number(event.is_active) === 1;

        return res.json({
          event: {
            id: event.id,
            slug: event.slug,
            name: event.name,
            status: event.status,
            otwarteTypowanie: otwarte,
            archiwalny: Number(event.is_archived) === 1,
          },
          ...statystyki,
        });
      } catch (err) {
        console.error("PICK STATS:", err);

        return res.status(500).json({
          error: "Nie udało się policzyć statystyk typów.",
          code: "server.pickStatsFailed",
        });
      }
    },
  );

  /**
   * Zbiorczo po wszystkich turniejach serwera.
   *
   * "Ogolem" da sie czytac dwojako - w biezacym turnieju albo odkad serwis
   * stoi. Ta trasa odpowiada na drugie pytanie i jest tania, bo liczy same
   * agregaty w bazie, bez wyciagania wierszy.
   */
  app.get(
    "/api/guilds/:guildId/pick-stats",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;

        const TABELE = [
          ["mecze", "match_predictions"],
          ["mapy", "match_map_predictions"],
          ["swiss", "swiss_predictions"],
          ["playin", "playin_predictions"],
          ["playoffs", "playoffs_predictions"],
          ["doubleelim", "doubleelim_predictions"],
          ["mvp", "mvp_predictions"],
        ];

        // Te same osiem obiegow do bazy co wyzej - naraz, nie w petli.
        // Nazwa tabeli pochodzi z TABELE powyzej, nie z zadania, wiec
        // wstawienie jej w zapytanie nie jest wejsciem uzytkownika.
        const policzone = await Promise.all(
          TABELE.map(([, tabela]) =>
            zapytaj(
              `
              SELECT COUNT(*) AS typow, COUNT(DISTINCT user_id) AS graczy
              FROM \`${tabela}\`
              WHERE guild_id = ?
              `,
              [guildId],
            ),
          ),
        );

        const fazy = {};

        let typowRazem = 0;

        TABELE.forEach(([nazwa], i) => {
          const w = policzone[i][0] ?? { typow: 0, graczy: 0 };

          fazy[nazwa] = {
            typow: Number(w.typow || 0),
            graczy: Number(w.graczy || 0),
          };

          typowRazem += fazy[nazwa].typow;
        });

        // ZLACZENIE TYLKO PO event_id, SWIADOMIE BEZ guild_id.
        //
        // Kolumna guild_id ma w tej bazie TRZY rozne kolacje: events jest
        // w utf8mb4_0900_ai_ci, match_predictions w utf8mb4_unicode_ci,
        // a playoffs_predictions samotnie w utf8mb4_general_ci. MySQL odmawia
        // porownania miedzy nimi (ER_CANT_AGGREGATE_2COLLATIONS), wiec
        // dolozenie tu warunku `mp.guild_id = e.guild_id` wywala cala trase.
        //
        // Nie jest on zresztą potrzebny: event_id wskazuje jeden konkretny
        // turniej, a ten nalezy do jednej gildii, ktora filtruje juz
        // WHERE e.guild_id. Gdyby ktos chcial go przywrocic "na wszelki
        // wypadek" - trzeba dopisac COLLATE, inaczej trasa przestaje dzialac.
        const turnieje = await zapytaj(
          `
          SELECT e.id, e.slug, e.name, e.status, e.is_archived,
                 COUNT(mp.match_id) AS typowMeczow,
                 COUNT(DISTINCT mp.user_id) AS graczy
          FROM events e
          LEFT JOIN match_predictions mp
            ON mp.event_id = e.id
          WHERE e.guild_id = ?
          GROUP BY e.id, e.slug, e.name, e.status, e.is_archived
          ORDER BY e.id DESC
          `,
          [guildId],
        );

        return res.json({
          typow: typowRazem,
          fazy,
          turnieje: turnieje.map((t) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
            status: t.status,
            archiwalny: Number(t.is_archived) === 1,
            typowMeczow: Number(t.typowMeczow || 0),
            graczy: Number(t.graczy || 0),
          })),
        });
      } catch (err) {
        console.error("PICK STATS ALL:", err);

        return res.status(500).json({
          error: "Nie udało się policzyć statystyk typów.",
          code: "server.pickStatsFailed",
        });
      }
    },
  );
}
