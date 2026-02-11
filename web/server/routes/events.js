import express from "express";
import { withGuild } from "../../../utils/guildContext.js";
import db from "../../../db.js";
import { error } from "node:console";

const router = express.Router();

router.get("/", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const guildId = req.user.guildId;

    try {
        const result = await withGuild(guildId, async () => {
            const pool = db.getPoolForGuild(guildId);

            const [rows] = await pool.query(
                "SELECT id, slug, name, status, deadline FROM events ORDER BY created_at DESC"
            );

            return rows;
        });

        res.json(result);
    } catch (err) {
        console.error("[events list]", err);
        res.status(500).json({ error: "Events error" });
    }
});

export default router;