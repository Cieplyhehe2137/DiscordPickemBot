import express from "express";
import db from "../../../db.js";
import { withGuild } from "../../../utils/guildContext.js";
import calculateScores from "../../../handlers/calculateScores.js";

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({ ok: true, route: "dashboard works" });
});

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
          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM swiss_predictions
          WHERE event_id = ?

          UNION

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM playoffs_predictions
          WHERE event_id = ?

          UNION

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM doubleelim_predictions
          WHERE event_id = ?

          UNION

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM playin_predictions
          WHERE event_id = ?

          UNION

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM match_predictions
          WHERE event_id = ?

          UNION

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM match_map_predictions
          WHERE event_id = ?

          UNION

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM mvp_predictions
          WHERE event_id = ?
        ) AS all_users
        `,
        [eventId, eventId, eventId, eventId, eventId, eventId, eventId]
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

      const [[mvpCount]] = await pool.query(
        `
        SELECT COUNT(*) AS count
        FROM mvp_predictions
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
      const mvpPredictions = Number(mvpCount?.count || 0);

      const totalPredictions =
        swissPredictions +
        playoffsPredictions +
        doubleEliminationPredictions +
        playInPredictions +
        matchPredictions +
        mapPredictions +
        mvpPredictions;

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
            mvp: mvpPredictions,
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
        SELECT id, name, slug
        FROM events
        WHERE slug = ? AND guild_id = ?
        LIMIT 1
        `,
        [slug, guildId]
      );

      if (!event) {
        return {
          event: null,
          rows: [],
        };
      }

      const eventId = event.id;

      const [rows] = await pool.query(
        `
        SELECT
          CAST(lb.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS user_id,

          COALESCE(
            CAST(u.username AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci,
            CAST(lb.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          ) AS username,

          lb.total_points AS points,

          COALESCE((
            SELECT SUM(points)
            FROM swiss_scores ss
            WHERE CAST(ss.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(lb.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
              AND ss.event_id = lb.event_id
              AND CAST(ss.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(lb.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          ), 0) AS swiss_points,

          COALESCE((
            SELECT SUM(points)
            FROM playoffs_scores ps
            WHERE CAST(ps.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(lb.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
              AND ps.event_id = lb.event_id
              AND CAST(ps.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(lb.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          ), 0) AS playoff_points,

          COALESCE((
            SELECT SUM(points)
            FROM mvp_scores ms
            WHERE CAST(ms.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(lb.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
              AND ms.event_id = lb.event_id
              AND CAST(ms.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(lb.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          ), 0) AS mvp_points,

          COALESCE((
            SELECT SUM(points)
            FROM match_points mp
            WHERE CAST(mp.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(lb.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
              AND mp.event_id = lb.event_id
              AND CAST(mp.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(lb.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          ), 0) AS match_points

        FROM leaderboard lb

        LEFT JOIN (
          SELECT
            user_id,
            MAX(displayname) AS username
          FROM (
            SELECT
              CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS user_id,
              CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS displayname
            FROM swiss_scores
            WHERE CAST(guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
              AND event_id = ?

            UNION ALL

            SELECT
              CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS user_id,
              CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS displayname
            FROM playoffs_scores
            WHERE CAST(guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
              AND event_id = ?

            UNION ALL

            SELECT
              CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS user_id,
              CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS displayname
            FROM doubleelim_scores
            WHERE CAST(guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
              AND event_id = ?

            UNION ALL

            SELECT
              CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS user_id,
              CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS displayname
            FROM playin_scores
            WHERE CAST(guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
              AND event_id = ?

            UNION ALL

            SELECT
              CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS user_id,
              CAST(displayname AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci AS displayname
            FROM mvp_scores
            WHERE CAST(guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
                  CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
              AND event_id = ?
          ) names
          GROUP BY user_id
        ) u
          ON CAST(u.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
             CAST(lb.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci

        WHERE CAST(lb.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
              CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          AND lb.event_id = ?

        ORDER BY
          lb.total_points DESC,
          CAST(lb.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci ASC

        LIMIT 5
        `,
        [
          guildId, eventId,
          guildId, eventId,
          guildId, eventId,
          guildId, eventId,
          guildId, eventId,
          guildId, eventId,
        ]
      );

      return {
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
        },
        rows: rows.map((row, index) => ({
          rank: index + 1,
          userId: row.user_id,
          username: row.username,
          points: Number(row.points || 0),
          swissPoints: Number(row.swiss_points || 0),
          playoffPoints: Number(row.playoff_points || 0),
          mvpPoints: Number(row.mvp_points || 0),
          matchPoints: Number(row.match_points || 0),
        })),
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("[dashboard top]", err);
    return res.status(500).json({ error: "Top fetch error" });
  }
});

/* ================= USER DETAILS ================= */

router.get("/:slug/users/:userId", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const { slug, userId } = req.params;
  const guildId = req.user.guildId;

  try {
    const result = await withGuild(guildId, async () => {
      const pool = db.getPoolForGuild(guildId);

      const [[event]] = await pool.query(
        `
        SELECT id, name, slug
        FROM events
        WHERE slug = ? AND guild_id = ?
        LIMIT 1
        `,
        [slug, guildId]
      );

      if (!event) {
        return null;
      }

      const eventId = event.id;

      const normalizeUserIdSql = `
        CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
      `;

      const normalizeGuildIdSql = `
        CAST(guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
      `;

      const userIdNorm = String(userId);
      const guildIdNorm = String(guildId);

      const picks = [];

      const [swissRows] = await pool.query(
        `
        SELECT stage, points, displayname
        FROM swiss_scores
        WHERE ${normalizeGuildIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          AND event_id = ?
          AND ${normalizeUserIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
        ORDER BY stage ASC
        `,
        [guildIdNorm, eventId, userIdNorm]
      );

      for (const row of swissRows) {
        const stageMap = {
          stage1: "Swiss Stage 1",
          stage2: "Swiss Stage 2",
          stage3: "Swiss Stage 3",
        };

        picks.push({
          stage: row.stage,
          label: stageMap[row.stage] || `Swiss ${row.stage}`,
          points: Number(row.points || 0),
        });
      }

      const [[playoffsRow]] = await pool.query(
        `
        SELECT points, displayname
        FROM playoffs_scores
        WHERE ${normalizeGuildIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          AND event_id = ?
          AND ${normalizeUserIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
        LIMIT 1
        `,
        [guildIdNorm, eventId, userIdNorm]
      );

      if (playoffsRow) {
        picks.push({
          stage: "playoffs",
          label: "Playoffs",
          points: Number(playoffsRow.points || 0),
        });
      }

      const [[doubleRow]] = await pool.query(
        `
        SELECT points, displayname
        FROM doubleelim_scores
        WHERE ${normalizeGuildIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          AND event_id = ?
          AND ${normalizeUserIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
        LIMIT 1
        `,
        [guildIdNorm, eventId, userIdNorm]
      );

      if (doubleRow) {
        picks.push({
          stage: "double_elimination",
          label: "Double Elimination",
          points: Number(doubleRow.points || 0),
        });
      }

      const [[playInRow]] = await pool.query(
        `
        SELECT points, displayname
        FROM playin_scores
        WHERE ${normalizeGuildIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          AND event_id = ?
          AND ${normalizeUserIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
        LIMIT 1
        `,
        [guildIdNorm, eventId, userIdNorm]
      );

      if (playInRow) {
        picks.push({
          stage: "play_in",
          label: "Play-In",
          points: Number(playInRow.points || 0),
        });
      }

      const [[mvpRow]] = await pool.query(
        `
        SELECT points, displayname
        FROM mvp_scores
        WHERE ${normalizeGuildIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          AND event_id = ?
          AND ${normalizeUserIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
        LIMIT 1
        `,
        [guildIdNorm, eventId, userIdNorm]
      );

      if (mvpRow) {
        picks.push({
          stage: "mvp",
          label: "MVP",
          points: Number(mvpRow.points || 0),
        });
      }

      const [[matchRow]] = await pool.query(
        `
        SELECT SUM(points) AS points
        FROM match_points
        WHERE ${normalizeGuildIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          AND event_id = ?
          AND ${normalizeUserIdSql} = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
        `,
        [guildIdNorm, eventId, userIdNorm]
      );

      if (matchRow && Number(matchRow.points || 0) > 0) {
        picks.push({
          stage: "matches",
          label: "Mecze",
          points: Number(matchRow.points || 0),
        });
      }

      const username =
        playoffsRow?.displayname ||
        doubleRow?.displayname ||
        playInRow?.displayname ||
        mvpRow?.displayname ||
        swissRows?.[0]?.displayname ||
        userIdNorm;

      const [matchBreakdownRows] = await pool.query(
        `
        SELECT
          m.id AS match_id,
          m.phase,
          m.match_no,
          m.team_a,
          m.team_b,
          SUM(CASE WHEN mp.source = 'series' THEN mp.points ELSE 0 END) AS series_points,
          SUM(CASE WHEN mp.source = 'map' THEN mp.points ELSE 0 END) AS map_points,
          SUM(mp.points) AS total_points
        FROM match_points mp
        JOIN matches m
          ON m.id = mp.match_id
         AND CAST(m.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
             CAST(mp.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
        WHERE CAST(mp.guild_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
              CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
          AND mp.event_id = ?
          AND CAST(mp.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci =
              CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_0900_ai_ci
        GROUP BY
          m.id,
          m.phase,
          m.match_no,
          m.team_a,
          m.team_b
        ORDER BY
          m.phase ASC,
          COALESCE(m.match_no, 999999) ASC,
          m.id ASC
        `,
        [guildIdNorm, eventId, userIdNorm]
      );

      const totalPoints = picks.reduce(
        (sum, row) => sum + Number(row.points || 0),
        0
      );

      return {
        user: {
          id: userIdNorm,
          username,
        },
        totalPoints,
        picks,
        matchBreakdown: matchBreakdownRows.map((row) => ({
          matchId: Number(row.match_id),
          phase: row.phase,
          matchNo: row.match_no !== null ? Number(row.match_no) : null,
          teamA: row.team_a,
          teamB: row.team_b,
          seriesPoints: Number(row.series_points || 0),
          mapPoints: Number(row.map_points || 0),
          totalPoints: Number(row.total_points || 0),
        })),
      };
    });

    if (!result) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.json(result);
  } catch (err) {
    console.error("[dashboard user details]", err);
    return res.status(500).json({ error: "User details fetch error" });
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