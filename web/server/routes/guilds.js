import express from "express";
import db from "../../../db.js";

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function requireGuildAccess(req, res, next) {
  const { guildId } = req.params;

  if (!req.session?.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const guild = req.session.user.guilds?.find((g) => String(g.id) === String(guildId));

  if (!guild) {
    return res.status(403).json({ error: "Guild not allowed" });
  }

  req.guildId = guildId;
  req.guild = guild;
  next();
}

router.use(requireAuth);

router.get("/:guildId/meta", requireGuildAccess, async (req, res) => {
  const guild = req.guild;

  res.json({
    id: guild.id,
    name: guild.name,
    icon: guild.icon ?? null,
    role: "admin",
    isAdmin: true,
  });
});

router.get("/:guildId/events/active", requireGuildAccess, async (req, res) => {
  try {
    const pool = db.getPoolForGuild(req.guildId);

    const [rows] = await pool.query(`
      SELECT id, name, slug, phase, status
      FROM events
      WHERE status != 'ARCHIVED'
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("GET /events/active error:", err);
    res.status(500).json({ error: "Failed to load active events" });
  }
});

router.get("/:guildId/events/archived", requireGuildAccess, async (req, res) => {
  try {
    const pool = db.getPoolForGuild(req.guildId);

    const [rows] = await pool.query(`
      SELECT id, name, slug, phase, status
      FROM events
      WHERE status = 'ARCHIVED' OR phase = 'FINISHED'
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("GET /events/archived error:", err);
    res.status(500).json({ error: "Failed to load archived events" });
  }
});

export default router;