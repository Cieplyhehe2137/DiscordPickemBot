import db from "../../../db.js";
import { withGuild } from "../../../utils/guildContext.js";

export async function updateLeaderboard(guildId, eventId) {
    await withGuild(guildId, async () => {
        const pool = db.getPoolForGuild(guildId);

        await pool.query(
            "DELETE FROM leaderboard WHERE guild_id = ? AND event_id = ?",
            [guildId, eventId]
        );

        const [rows] = await pool.query(
            `SELECT user_id, SUM(points) AS total_points
            FROM match_predictions
            WHERE event_id = ?
            GROUP BY user_id
            `,
            [eventId]
        );

        for (const row of rows) {
            await pool.query(
                `INSERT INTO leaderboard
                (guild_id, event_id, user_id, total_points)
                VALUES (?, ?, ?, ?)
                `,
                [guildId, eventId, row.user_id, row.total_points]
            );
        }
    });
}