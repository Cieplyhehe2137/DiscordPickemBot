import express from "express";
import { requireGuild } from "../middleware/requireGuild.js";
import { getPoolForGuild } from "../../../db.js";

const router = express.Router();

router.use(requireGuild);

router.get("/active", async (req, res) => {
  try {
    const guildId = req.guildId;
    const pool = getPoolForGuild(guildId);

    const [rows] = await pool.query(`
      SELECT
        id,
        name,
        slug,
        phase,
        status
      FROM events
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("events active error", err);
    res.status(500).json({ error: "Failed to load active events" });
  }
});

router.get("/archived", async (req, res) => {
  try {
    const guildId = req.guildId;

    const pool = getPoolForGuild(guildId);

    const [rows] = await pool.query(
      `
      SELECT
        id,
        name,
        slug,
        phase,
        status
      FROM events
      WHERE archived = 1
      ORDER BY id DESC
      `
    );

    res.json(rows);
  } catch (err) {
    console.error("events archived error", err);
    res.status(500).json({ error: "Failed to load archived events" });
  }
});

export default router;