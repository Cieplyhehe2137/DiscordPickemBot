import express from "express";
import db from "../../../db.js";
import { withGuild } from "../../../utils/guildContext.js";

const router = express.Router();


router.get("/", async (req, res) => {
  const guildId = req.user.guildId;

  try {
    const result = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [rows] = await pool.query(
        "SELECT * FROM events WHERE guild_id = ? ORDER BY created_at DESC",
        [guildId]
      );

      return rows;
    });

    res.json(result);
  } catch (err) {
    console.error("[events list]", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});


router.post("/:slug/archive", async (req, res) => {
  const { slug } = req.params;
  const guildId = req.user.guildId;

  await withGuild(guildId, async () => {
    const pool = db.getPoolForGuild(guildId);

    await pool.query(
      "UPDATE events SET is_archived = 1 WHERE slug = ? AND guild_id = ?",
      [slug, guildId]
    );
  });

  res.json({ ok: true });
});


router.post("/:slug/archive", async (req, res) => {
  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      await pool.query(
        "UPDATE events SET is_archived = 1 WHERE slug = ? AND guild_id = ?",
        [slug, guildId]
      );
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[archive event]", err);
    res.status(500).json({ error: "Failed to archive event" });
  }
});

/**
 * GET /api/events/active
 */
router.get("/active", async (req, res) => {
  const guildId = req.user.guildId;

  try {
    const result = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [rows] = await pool.query(
        "SELECT * FROM events WHERE status != 'ARCHIVED' ORDER BY id DESC"
      );

      return rows;
    });

    res.json(result);
  } catch (err) {
    console.error("[events active]", err);
    res.status(500).json({ error: "Failed to fetch active events" });
  }
});


/**
 * GET /api/events/archived
 */
router.get("/archived", async (req, res) => {
  const guildId = req.user.guildId;

  try {
    const result = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [rows] = await pool.query(
        "SELECT * FROM events WHERE status = 'ARCHIVED' ORDER BY id DESC"
      );

      return rows;
    });

    res.json(result);
  } catch (err) {
    console.error("[events archived]", err);
    res.status(500).json({ error: "Failed to fetch archived events" });
  }
});



export default router;