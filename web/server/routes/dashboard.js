import express from "express";
import { withGuild } from "../../../utils/guildContext.js";
import db from "../../../db.js";

const router = express.Router();

router.get("/summary", async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const guildId = req.user.guildId;

    try {
        const result = await withGuild(guildId, async () => {
            const pool = db.getPoolForGuild(guildId);

            // uczestnicy
            const [[participants]] = await pool.query(
                "SELECT COUNT(DISTINCT user_id) AS count FROM swiss_predictions"
            );

            // typy
            const [[predictions]] = await pool.query(
                "SELECT COUNT(*) AS count FROM swiss_predictions"
            );

            // 🛡️ BEZPIECZNY fallback – brak tournament_state
            let phase = "UNKNOWN";
            let isOpen = false;

            try {
                const [[state]] = await pool.query(
                    "SELECT phase, is_open FROM tournament_state LIMIT 1"
                );
                if (state) {
                    phase = state.phase;
                    isOpen = !!state.is_open;
                }
            } catch (err) {
                // tabela nie istnieje → OK, działamy dalej
            }

            return {
                phase,
                isOpen,
                participants: participants.count,
                predictions: predictions.count
            };
        });

        res.json(result);
    } catch (err) {
        console.error("[dashboard summary]", err);
        res.status(500).json({ error: "Dashboard error" });
    }
});


export default router;