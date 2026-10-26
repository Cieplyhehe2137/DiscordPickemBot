// Lista turniejow do wyboru: GET /api/events/active.
//
// Jedno zapytanie z licznikiem typujacych w podzapytaniu. Z tego
// zestawienia front buduje wybieraczke turnieju - i tylko z niego,
// wiec kazde pole, ktore tu stoi, jest na ekranie.
//
// Wydzielone z events.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

export function registerActiveEventRoutes(app, { pool }) {
  app.get("/api/events/active", async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          e.id,
          e.name,
          e.slug,
          e.phase,
          e.status,

          (
            SELECT COUNT(DISTINCT mp.user_id)
            FROM match_predictions mp
            WHERE mp.event_id = e.id
          ) AS participants,

          (
            SELECT COUNT(*)
            FROM match_predictions mp
            WHERE mp.event_id = e.id
          ) AS predictions,

          (
            -- Panel należy wprost do eventu (migracja 0004). Wcześniej parowanie
            -- szło po guild_id + phase i dla Swiss nie trafiało nigdy:
            -- active_panels.phase trzyma 'swiss_stage1', a events.phase 'SWISS'.
            -- Dla pozostałych faz działało tylko dzięki temu, że utf8mb4_unicode_ci
            -- ignoruje wielkość liter ('PLAYOFFS' = 'playoffs') - stąd te CAST-y
            -- na kolację, teraz niepotrzebne.
            --
            -- Bez warunku na fazę, bo publisher gasi wszystkie panele gildii przy
            -- publikacji nowego, więc aktywny panel eventu jest dokładnie jeden.
            SELECT ap.deadline
            FROM active_panels ap
            WHERE ap.event_id = e.id
              AND ap.active = 1
              AND ap.deadline IS NOT NULL
            ORDER BY ap.deadline ASC
            LIMIT 1
          ) AS deadline

        FROM events e
        WHERE e.is_active = 1
          AND e.is_archived = 0
        ORDER BY e.id DESC
      `);

      res.json({
        events: rows,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Błąd bazy danych.",
        code: "server.dbError",
      });
    }
  });
}
