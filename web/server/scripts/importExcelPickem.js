import ExcelJS from "exceljs";
import { getPoolForGuild } from "../../../db.js";

const FILE_PATH = "./web/server/scripts/imports/Starladder Budapest Major 2025.xlsx";
const GUILD_ID = "1161660208951607397";
const EVENT_SLUG = "starladder-budapest-2025";

async function run() {
    const pool = getPoolForGuild(GUILD_ID);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(FILE_PATH);

    const sheet = workbook.getWorksheet("Klasyfikacja ogólna");

    if (!sheet) {
        throw new Error("Brak arkusza Klasyfikacja ogólna");
    }

    // 🔥 znajdź event
    const [[event]] = await pool.query(
        `SELECT id FROM events WHERE slug = ? LIMIT 1`,
        [EVENT_SLUG]
    );

    if (!event) {
        throw new Error("Event nie istnieje w DB");
    }

    const eventId = event.id;

    console.log("Event ID:", eventId);

    for (let i = 2; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);

        const rawUserId = row.getCell(2).value;
        const userId = String(rawUserId || "").trim();

        if (!/^\d{15,25}$/.test(userId)) {
            console.log("SKIP invalid userId row:", i, rawUserId);
            continue;
        }

        const username = String(row.getCell(3).value || "").trim() || userId;

        const swiss1 = Number(row.getCell(4).value || 0);
        const swiss2 = Number(row.getCell(5).value || 0);
        const swiss3 = Number(row.getCell(6).value || 0);
        const playoffs = Number(row.getCell(7).value || 0);
        const doubleElim = Number(row.getCell(8).value || 0);
        const total = Number(row.getCell(9).value || 0);

        if (!userId) continue;

        console.log("Import:", username, total);

        // 🔥 leaderboard
        await pool.query(
            `
      INSERT INTO leaderboard (guild_id, event_id, user_id, total_points)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE total_points = VALUES(total_points)
      `,
            [GUILD_ID, eventId, userId, total]
        );

        // 🔥 swiss (3 stage)
        await pool.query(
            `
      INSERT INTO swiss_scores (guild_id, event_id, user_id, displayname, stage, points)
  VALUES (?, ?, ?, ?, 'stage1', ?),
         (?, ?, ?, ?, 'stage2', ?),
         (?, ?, ?, ?, 'stage3', ?)
  ON DUPLICATE KEY UPDATE
    displayname = VALUES(displayname),
    points = VALUES(points)
  `,
  [
    GUILD_ID, eventId, userId, username, swiss1,
    GUILD_ID, eventId, userId, username, swiss2,
    GUILD_ID, eventId, userId, username, swiss3,
  ]
);

        // 🔥 playoffs
        await pool.query(
            `
      INSERT INTO playoffs_scores (guild_id, event_id, user_id, points)
  VALUES (?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    points = VALUES(points)
  `,
  [GUILD_ID, eventId, userId, playoffs]
);

        // 🔥 double elim (jeśli masz tabelę)
        if (doubleElim > 0) {
            await pool.query(
                `
        INSERT INTO doubleelim_scores (guild_id, event_id, user_id, points)
        VALUES (?, ?, ?, ?)
        `,
                [GUILD_ID, eventId, userId, doubleElim]
            );
        }
    }

    console.log("✅ IMPORT ZAKOŃCZONY");
}

run().catch(console.error);