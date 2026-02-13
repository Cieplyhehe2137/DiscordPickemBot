import express from "express";
import db from "../../../db.js";
import { withGuild } from "../../../utils/guildContext.js";
import calculateScores from "../../../handlers/calculateScores.js";

const router = express.Router();

const ALLOWED_PHASES = [
  "SWISS_STAGE_1",
  "SWISS_STAGE_2",
  "SWISS_STAGE_3",
  "PLAYOFFS",
  "FINISHED",
];

/* ================= SUMMARY ================= */

router.get("/:slug/summary", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    const result = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [[event]] = await pool.query(
        "SELECT id, name, phase, status, deadline FROM events WHERE slug = ? AND guild_id = ?",
        [slug, guildId]
      );

      if (!event) return null;

      const eventId = event.id;

      const [[participants]] = await pool.query(
        "SELECT COUNT(DISTINCT user_id) AS count FROM swiss_predictions WHERE event_id = ?",
        [eventId]
      );

      const [[predictions]] = await pool.query(
        "SELECT COUNT(*) AS count FROM swiss_predictions WHERE event_id = ?",
        [eventId]
      );

      return {
        name: event.name,
        phase: event.phase,
        isOpen: event.status === "OPEN",
        participants: participants.count,
        predictions: predictions.count,
        completionRate:
          participants.count === 0
            ? 0
            : Math.round(
              (predictions.count / participants.count) * 100
            ),
        deadline: event.deadline,
        isAdmin: !!req.user?.isAdmin,
      };
    });

    if (!result) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(result);
  } catch (err) {
    console.error("[dashboard summary]", err);
    res.status(500).json({ error: "Dashboard error" });
  }
});

/* ================= TOP 5 ================= */

router.get("/:slug/top", async (req, res) => {
  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    const result = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE slug = ?",
        [slug]
      );

      if (!event) return [];

      const [rows] = await pool.query(
        `
        SELECT user_id, total_points
        FROM leaderboard
        WHERE guild_id = ? AND event_id = ?
        ORDER BY total_points DESC
        LIMIT 5
        `,
        [guildId, event.id]
      );

      return rows;
    });

    res.json(result);
  } catch (err) {
    console.error("[dashboard top]", err);
    res.status(500).json({ error: "Top fetch error" });
  }
});

/* ================= OPEN ================= */

router.post("/:slug/open", async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin only" });
  }

  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      await pool.query(
        "UPDATE events SET status = 'OPEN' WHERE slug = ? AND guild_id = ?",
        [slug, guildId]
      );
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[dashboard open]", err);
    res.status(500).json({ error: "Failed to open event" });
  }
});

/* ================= CLOSE ================= */

router.post("/:slug/close", async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin only" });
  }

  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      await pool.query(
        "UPDATE events SET status = 'CLOSED' WHERE slug = ? AND guild_id = ?",
        [slug, guildId]
      );
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[dashboard close]", err);
    res.status(500).json({ error: "Failed to close event" });
  }
});

/* ================= PHASE ================= */

router.post("/:slug/phase", async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin only" });
  }

  const { slug } = req.params;
  const { phase } = req.body;
  const guildId = req.user.guildId;

  if (!ALLOWED_PHASES.includes(phase)) {
    return res.status(400).json({ error: "Invalid phase" });
  }

  try {
    await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      await pool.query(
        "UPDATE events SET phase = ? WHERE slug = ? AND guild_id = ?",
        [phase, slug, guildId]
      );
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[dashboard phase]", err);
    res.status(500).json({ error: "Failed to update phase" });
  }
});

/**
 * POST /api/dashboard/:slug/recalculate
 */
router.post("/:slug/recalculate", async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin only" });
  }

  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE slug = ?",
        [slug]
      );

      if (!event) {
        throw new Error("Event not found");
      }

      await calculateScores(guildId, event.id);
    });

    res.json({ ok: true });

  } catch (err) {
    console.error("[recalculate]", err);
    res.status(500).json({ error: "Recalculate failed" });
  }
});

export default router;