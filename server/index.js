import express from 'express';
import cors from 'cors';
import { pool } from './db.js'

const app = express();

app.use(express.json());

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.get('/api/auth/me', (req, res) => {
    res.json({
        user: {
            id: '123',
            username: 'lukasz'
        }
    });
});

app.get('/api/events/active', async (req, res) => {
    try {
        const [rows] = await pool.query(`
      SELECT
        id,
        name,
        slug,
        phase,
        status
      FROM events
      WHERE status = 'active'
      ORDER BY id DESC
    `);

        res.json({
            events: rows
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/events/:slug/summary', async (req, res) => {
    try {
        const { slug } = req.params;

        const [[event]] = await pool.query(
            `
      SELECT
        id,
        name,
        slug,
        phase,
        status
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
            [slug]
        );

        if (!event) {
            return res.status(404).json({
                error: 'Event not found'
            });
        }

        const [[matchStats]] = await pool.query(
            `
      SELECT
        COUNT(*) AS total_matches
      FROM matches
      WHERE event_id = ?
      `,
            [event.id]
        );

        const [[predictionStats]] = await pool.query(
            `
      SELECT
        COUNT(DISTINCT user_id) AS participants,
        COUNT(*) AS predictions
      FROM match_predictions
      WHERE event_id = ?
      `,
            [event.id]
        );

        const [[statusStats]] = await pool.query(
            `
  SELECT
    COUNT(*) AS total,
    SUM(is_locked = 1) AS locked_matches,
    SUM(is_locked = 0) AS scheduled_matches
  FROM matches
  WHERE event_id = ?
  `,
            [event.id]
        );

        const [[nextMatch]] = await pool.query(
            `
  SELECT
    id,
    phase,
    team_a,
    team_b,
    best_of,
    start_time_utc,
    is_locked
  FROM matches
  WHERE event_id = ?
    AND start_time_utc IS NOT NULL
    AND start_time_utc >= UTC_TIMESTAMP()
  ORDER BY start_time_utc ASC
  LIMIT 1
  `,
            [event.id]
        );

        res.json({
            event,
            stats: {
                participants: predictionStats?.participants || 0,
                predictions: predictionStats?.predictions || 0,
                matches: matchStats?.total_matches || 0
            },
            match_status: {
                total: statusStats?.total || 0,
                live: 0,
                finished: 0,
                locked: statusStats?.locked_matches || 0,
                scheduled: statusStats?.scheduled_matches || 0
            },
            next_match: nextMatch || null,

            phase_info: {
                current: event.phase,
                status: event.status
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/events/:slug/matches', async (req, res) => {
    try {
        const { slug } = req.params;

        const [[event]] = await pool.query(
            `
      SELECT id, name, slug
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
            [slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const [matches] = await pool.query(
  `
  SELECT
    id,
    phase,
    match_no,
    team_a,
    team_b,
    best_of,
    start_time_utc,
    is_locked,

    CASE
      WHEN is_locked = 1 THEN 'LOCKED'
      ELSE 'OPEN'
    END AS ui_status

  FROM matches
  WHERE event_id = ?
  ORDER BY match_no ASC, id ASC
  `,
  [event.id]
);

        res.json({ event, matches });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/events/:slug/leaderboard', async (req, res) => {
    try {
        const { slug } = req.params;

        const [[event]] = await pool.query(
            `
      SELECT id
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
            [slug]
        );

        if (!event) {
            return res.status(404).json({
                error: 'Event not found'
            });
        }

        const [rows] = await pool.query(
            `
  SELECT
    user_id,
    SUM(points) AS total_points
  FROM match_points
  WHERE event_id = ?
  GROUP BY user_id
  ORDER BY total_points DESC
  LIMIT 10
  `,
            [event.id]
        );

        res.json({
            leaderboard: rows
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/debug/matches-columns', async (req, res) => {
    try {
        const [rows] = await pool.query(`
      SHOW COLUMNS FROM matches
    `);

        res.json(rows);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.listen(3301, () => {
    console.log('WEB SERWER DZIAŁA NA http://localhost:3301');
});