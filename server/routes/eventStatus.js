// Zmiana stanu turnieju: POST /api/events/:slug/status.
//
// Panel wysyla OPEN / CLOSED / ARCHIVED, ale ARCHIVED nie jest
// wartoscia kolumny status - archiwizacja to FINISHED razem
// z is_archived = 1, tak samo jak zapisuje to zakonczenie turnieju.
// Tablica STATUS_ACTIONS trzyma to tlumaczenie w jednym miejscu.
//
// Jedyna trasa w tej grupie za requireGuildAdmin.
//
// Wydzielone z events.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

export function registerEventStatusRoutes(
  app,
  {
    emitDashboardRefresh,
    guildIdFromEventSlug,
    io,
    pool,
    requireGuildAdmin,
  },
) {
  app.post(
    "/api/events/:slug/status",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { status } = req.body;
        const { guildId } = req;

        // The UI sends OPEN / CLOSED / ARCHIVED. ARCHIVED is not a value of
        // the events.status enum ('UPCOMING','OPEN','CLOSED','FINISHED') -
        // archiving is stored as status FINISHED + is_archived = 1, matching
        // what the end-tournament endpoint writes.
        const STATUS_ACTIONS = {
          OPEN: { status: "OPEN", is_open: 1, is_active: 1, is_archived: 0 },
          CLOSED: { status: "CLOSED", is_open: 0, is_active: 1, is_archived: 0 },
          ARCHIVED: {
            status: "FINISHED",
            is_open: 0,
            is_active: 0,
            is_archived: 1,
          },
        };

        const action = STATUS_ACTIONS[String(status || "").toUpperCase()];

        if (!action) {
          return res.status(400).json({
            error: "Nieprawidłowy status.",
            code: "server.badStatus",
            allowedStatuses: Object.keys(STATUS_ACTIONS),
          });
        }

        const [result] = await pool.query(
          `
    UPDATE events
    SET
      status = ?,
      is_open = ?,
      is_active = ?,
      is_archived = ?
    WHERE guild_id = ?
      AND slug = ?
    LIMIT 1
    `,
          [
            action.status,
            action.is_open,
            action.is_active,
            action.is_archived,
            guildId,
            slug,
          ],
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }
        emitDashboardRefresh({
          slug,
          guildId,
          reason: "event_status_updated",
        });

        // Broadcast the status actually stored, not the requested action -
        // "ARCHIVED" is persisted as FINISHED + is_archived, so echoing the
        // raw input would leave every open client showing a status that
        // does not exist in the database.
        io.emit("event:status_updated", {
          slug,
          status: action.status,
          is_archived: action.is_archived,
        });

        res.json({
          ok: true,
          slug,
          status: action.status,
          is_archived: action.is_archived,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );
}
