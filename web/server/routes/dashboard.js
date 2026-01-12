import express from "express";
import { withGuild } from "../../../utils/guildContext.js";
import db from "../../../db.js";
import { logTournamentAction } from "../../../utils/auditLog.js";
import { ensureTournamentState } from "../../../utils/ensureTournamentTables.js";

const router = express.Router();

const ALLOWED_PHASES = [
  "SWISS_STAGE_1",
  "SWISS_STAGE_2",
  "SWISS_STAGE_3",
  "PLAYOFFS",
  "FINISHED",
];

/**
 * GET /api/dashboard/summary
 */
router.get("/summary", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const guildId = req.user.guildId;

  try {
    const result = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      await ensureTournamentState(pool);

      const [[participants]] = await pool.query(
        "SELECT COUNT(DISTINCT user_id) AS count FROM swiss_predictions"
      );

      const [[predictions]] = await pool.query(
        "SELECT COUNT(*) AS count FROM swiss_predictions"
      );

      const [[state]] = await pool.query(
        "SELECT phase, is_open FROM tournament_state WHERE id = 1"
      );

      return {
        phase: state?.phase ?? "UNKNOWN",
        isOpen: !!state?.is_open,
        participants: participants.count,
        predictions: predictions.count,
        isAdmin: !!req.user?.isAdmin,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("[dashboard summary]", err);
    res.status(500).json({ error: "Dashboard error" });
  }
});

/**
 * POST /api/dashboard/open
 */
router.post("/open", async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin only" });
  }

  const guildId = req.user.guildId;

  try {
    await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      await ensureTournamentState(pool);

      await pool.query("UPDATE tournament_state SET is_open = 1 WHERE id = 1");
    });

    await logTournamentAction({
      guildId,
      actorId: req.user.discordId,
      action: "OPEN_PREDICTIONS",
      oldValue: "CLOSED",
      newValue: "OPEN",
    });

    res.json({ ok: true, isOpen: true });
  } catch (err) {
    console.error("[dashboard open]", err);
    res.status(500).json({ error: "Failed to open predictions" });
  }
});

/**
 * POST /api/dashboard/close
 */
router.post("/close", async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin only" });
  }

  const guildId = req.user.guildId;

  try {
    await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      await ensureTournamentState(pool);

      await pool.query("UPDATE tournament_state SET is_open = 0 WHERE id = 1");
    });

    await logTournamentAction({
      guildId,
      actorId: req.user.discordId,
      action: "CLOSE_PREDICTIONS",
      oldValue: "OPEN",
      newValue: "CLOSED",
    });

    res.json({ ok: true, isOpen: false });
  } catch (err) {
    console.error("[dashboard close]", err);
    res.status(500).json({ error: "Failed to close predictions" });
  }
});

/**
 * POST /api/dashboard/phase
 */
router.post("/phase", async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin only" });
  }

  const guildId = req.user.guildId;
  const { phase } = req.body;

  if (!ALLOWED_PHASES.includes(phase)) {
    return res.status(400).json({ error: "Invalid phase" });
  }

  try {
    let oldPhase = "UNKNOWN";

    await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      await ensureTournamentState(pool);

      const [[current]] = await pool.query(
        "SELECT phase FROM tournament_state WHERE id = 1"
      );
      oldPhase = current?.phase ?? "UNKNOWN";

      await pool.query("UPDATE tournament_state SET phase = ? WHERE id = 1", [
        phase,
      ]);
    });

    await logTournamentAction({
      guildId,
      actorId: req.user.discordId,
      action: "CHANGE_PHASE",
      oldValue: oldPhase,
      newValue: phase,
    });

    res.json({ ok: true, phase });
  } catch (err) {
    console.error("[dashboard phase]", err);
    res.status(500).json({ error: "Failed to update phase" });
  }
});

export default router;
