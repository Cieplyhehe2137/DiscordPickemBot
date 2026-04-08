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
  "DOUBLE_ELIMINATION",
  "PLAY_IN",
  "FINISHED",
];

function requireAuth(req, res) {
  if (!req.user || !req.user.guildId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

function requireAdmin(req, res) {
  if (!req.user || !req.user.guildId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return false;
  }

  return true;
}

/* ================= SUMMARY ================= */

router.get("/:slug/summary", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    const result = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [[event]] = await pool.query(
        `
        SELECT id, name, slug, phase, status, deadline
        FROM events
        WHERE slug = ? AND guild_id = ?
        LIMIT 1
        `,
        [slug, guildId]
      );

      if (!event) return null;

      const eventId = event.id;

      const [participantRows] = await pool.query(
        `
        SELECT COUNT(DISTINCT user_id) AS count
        FROM (
          SELECT user_id FROM swiss_predictions WHERE event_id = ?
          UNION
          SELECT user_id FROM playoffs_predictions WHERE event_id = ?
          UNION
          SELECT user_id FROM doubleelim_predictions WHERE event_id = ?
          UNION
          SELECT user_id FROM playin_predictions WHERE event_id = ?
          UNION
          SELECT user_id FROM match_predictions WHERE event_id = ?
          UNION
          SELECT user_id FROM match_map_predictions WHERE event_id = ?
        ) AS all_users
        `,
        [eventId, eventId, eventId, eventId, eventId, eventId]
      );

      const [[swissCount]] = await pool.query(
        `
        SELECT COUNT(*) AS count
        FROM swiss_predictions
        WHERE event_id = ?
        `,
        [eventId]
      );

      const [[playoffsCount]] = await pool.query(
        `
        SELECT COUNT(*) AS count
        FROM playoffs_predictions
        WHERE event_id = ?
        `,
        [eventId]
      );

      const [[doubleElimCount]] = await pool.query(
        `
        SELECT COUNT(*) AS count
        FROM doubleelim_predictions
        WHERE event_id = ?
        `,
        [eventId]
      );

      const [[playInCount]] = await pool.query(
        `
        SELECT COUNT(*) AS count
        FROM playin_predictions
        WHERE event_id = ?
        `,
        [eventId]
      );

      const [[matchCount]] = await pool.query(
        `
        SELECT COUNT(*) AS count
        FROM match_predictions
        WHERE event_id = ?
        `,
        [eventId]
      );

      const [[mapCount]] = await pool.query(
        `
        SELECT COUNT(*) AS count
        FROM match_map_predictions
        WHERE event_id = ?
        `,
        [eventId]
      );

      const participants = Number(participantRows?.[0]?.count || 0);

      const swissPredictions = Number(swissCount?.count || 0);
      const playoffsPredictions = Number(playoffsCount?.count || 0);
      const doubleEliminationPredictions = Number(doubleElimCount?.count || 0);
      const playInPredictions = Number(playInCount?.count || 0);
      const matchPredictions = Number(matchCount?.count || 0);
      const mapPredictions = Number(mapCount?.count || 0);

      const totalPredictions =
        swissPredictions +
        playoffsPredictions +
        doubleEliminationPredictions +
        playInPredictions +
        matchPredictions +
        mapPredictions;

      return {
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
          deadline: event.deadline,
        },
        tournament: {
          phase: event.phase,
          status: event.status,
          isOpen: event.status === "OPEN",
        },
        stats: {
          participants,
          predictions: totalPredictions,
          byType: {
            swiss: swissPredictions,
            playoffs: playoffsPredictions,
            doubleElimination: doubleEliminationPredictions,
            playIn: playInPredictions,
            matches: matchPredictions,
            maps: mapPredictions,
          },
        },
        permissions: {
          isAdmin: !!req.user.isAdmin,
        },
      };
    });

    if (!result) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.json(result);
  } catch (err) {
    console.error("[dashboard summary]", err);
    return res.status(500).json({ error: "Dashboard error" });
  }
});

/* ================= TOP ================= */

router.get("/:slug/top", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    const result = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [[event]] = await pool.query(
        `
        SELECT id
        FROM events
        WHERE slug = ? AND guild_id = ?
        LIMIT 1
        `,
        [slug, guildId]
      );

      if (!event) return [];

      const [rows] = await pool.query(
        `
        SELECT
          user_id,
          total_points
        FROM leaderboard
        WHERE guild_id = ? AND event_id = ?
        ORDER BY total_points DESC, user_id ASC
        LIMIT 5
        `,
        [guildId, event.id]
      );

      return rows.map((row, index) => ({
        rank: index + 1,
        userId: row.user_id,
        points: Number(row.total_points || 0),
      }));
    });

    return res.json(result);
  } catch (err) {
    console.error("[dashboard top]", err);
    return res.status(500).json({ error: "Top fetch error" });
  }
});

/* ================= OPEN ================= */

router.post("/:slug/open", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    const updated = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [result] = await pool.query(
        `
        UPDATE events
        SET status = 'OPEN'
        WHERE slug = ? AND guild_id = ?
        `,
        [slug, guildId]
      );

      return result.affectedRows;
    });

    if (!updated) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.json({ ok: true, status: "OPEN" });
  } catch (err) {
    console.error("[dashboard open]", err);
    return res.status(500).json({ error: "Failed to open event" });
  }
});

/* ================= CLOSE ================= */

router.post("/:slug/close", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    const updated = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [result] = await pool.query(
        `
        UPDATE events
        SET status = 'CLOSED'
        WHERE slug = ? AND guild_id = ?
        `,
        [slug, guildId]
      );

      return result.affectedRows;
    });

    if (!updated) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.json({ ok: true, status: "CLOSED" });
  } catch (err) {
    console.error("[dashboard close]", err);
    return res.status(500).json({ error: "Failed to close event" });
  }
});

/* ================= PHASE ================= */

router.post("/:slug/phase", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { slug } = req.params;
  const { phase } = req.body;
  const guildId = req.user.guildId;

  if (!phase || !ALLOWED_PHASES.includes(phase)) {
    return res.status(400).json({ error: "Invalid phase" });
  }

  try {
    const updated = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [result] = await pool.query(
        `
        UPDATE events
        SET phase = ?
        WHERE slug = ? AND guild_id = ?
        `,
        [phase, slug, guildId]
      );

      return result.affectedRows;
    });

    if (!updated) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.json({ ok: true, phase });
  } catch (err) {
    console.error("[dashboard phase]", err);
    return res.status(500).json({ error: "Failed to update phase" });
  }
});

/* ================= RECALCULATE ================= */

router.post("/:slug/recalculate", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { slug } = req.params;
  const guildId = req.user.guildId;

  try {
    await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [[event]] = await pool.query(
        `
        SELECT id
        FROM events
        WHERE slug = ? AND guild_id = ?
        LIMIT 1
        `,
        [slug, guildId]
      );

      if (!event) {
        throw new Error("Event not found");
      }

      await calculateScores(guildId, event.id);
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[dashboard recalculate]", err);

    if (err.message === "Event not found") {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.status(500).json({ error: "Recalculate failed" });
  }
});

export default router;