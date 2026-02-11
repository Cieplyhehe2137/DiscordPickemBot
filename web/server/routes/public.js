import express from "express";
import { withGuild } from "../../../utils/guildContext.js";
import db from "../../../db.js";

const router = express.Router();

/**
 * GET /api/public/events
 */
router.get("/events", async (req, res) => {
  const guildId = "1161660208951607397"; // na razie hardcoded testowo

  try {
    const result = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [events] = await pool.query(`
        SELECT 
          e.id,
          e.slug,
          e.name,
          ts.phase,
          ts.is_open
        FROM events e
        LEFT JOIN tournament_state ts 
          ON ts.event_id = e.id
        ORDER BY e.id DESC
      `);

      return events;
    });

    res.json(result);
  } catch (err) {
    console.error("[public events]", err);
    res.status(500).json({ error: "Public events error" });
  }
});

export default router;
