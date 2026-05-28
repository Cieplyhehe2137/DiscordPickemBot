import express from 'express';
import cors from 'cors';
import { pool } from './db.js'
import { createRequire } from 'module';
import dotenv from 'dotenv';
dotenv.config();
console.log('[ENV] DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID);
console.log('[ENV] DISCORD_REDIRECT_URI:', process.env.DISCORD_REDIRECT_URI);
import http from 'http';
import { Server } from 'socket.io';
import { startCs2LogReceiver } from './live/cs2LogReceiver.js';
import { parseCs2LogLine } from './live/cs2LogParser.js';
import session from 'express-session';

const require = createRequire(import.meta.url);
const calculateScores = require('../handlers/calculateScores');

const app = express();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log('Frontend connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Frontend disconnected:', socket.id);
    });
});

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'pickem-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

app.get('/api/auth/me', (req, res) => {
    res.json({
        user: req.session?.user || null
    });
});

app.get('/api/auth/discord', (req, res) => {
    console.log('[AUTH] Discord login start');

    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds'
    });

    const url = `https://discord.com/oauth2/authorize?${params.toString()}`;

    console.log('[AUTH] Redirect URL:', url);

    res.redirect(url);
});

app.get('/api/auth/discord/callback', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).send('Missing code');
        }

        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.DISCORD_REDIRECT_URI
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('Discord token error:', tokenData);
            return res.status(401).send('Discord OAuth failed');
        }

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const discordUser = await userResponse.json();

        if (!userResponse.ok) {
            console.error('Discord user error:', discordUser);
            return res.status(401).send('Discord user fetch failed');
        }

        req.session.user = {
            id: discordUser.id,
            username: discordUser.username,
            global_name: discordUser.global_name,
            avatar: discordUser.avatar
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).send('Session save failed');
            }

            res.redirect('http://localhost:5173/public');
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('OAuth callback failed');
    }
});

app.get('/api/auth/dev-login', (req, res) => {
    req.session.user = {
        id: '461851082570596352',
        username: 'cieplyhehe',
        global_name: 'cieplyhehe',
        avatar: null
    };

    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
            return res.status(500).send('Session save failed');
        }

        res.redirect('http://localhost:5173/public');
    });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({
            ok: true
        });
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
  LIMIT 8
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

app.post('/api/events/:slug/status', async (req, res) => {
    try {
        const { slug } = req.params;
        const { status } = req.body;

        const allowedStatuses = ['active', 'closed', 'archived'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                allowedStatuses
            });
        }

        const [result] = await pool.query(
            `
      UPDATE events
      SET status = ?
      WHERE slug = ?
      LIMIT 1
      `,
            [status, slug]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Event not found'
            });
        }
        io.emit('dashboard:refresh', { slug });

        io.emit('event:status_updated', {
            slug,
            status
        });

        res.json({
            ok: true,
            slug,
            status
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/guilds', async (req, res) => {
    res.json({
        guilds: [
            {
                id: '1161660208951607397',
                name: 'Hyperland',
                role: 'admin'
            }
        ]
    });
});

app.get('/api/guilds/:guildId/events', async (req, res) => {
    try {
        const { guildId } = req.params;

        const [events] = await pool.query(
            `
      SELECT
  e.id,
  e.guild_id,
  e.name,
  e.slug,
  e.phase,
  e.status,
  e.created_at,

  (
    SELECT COUNT(*)
    FROM matches m
    WHERE m.event_id = e.id
  ) AS matches_count,

  (
    SELECT COUNT(*)
    FROM match_predictions mp
    WHERE mp.event_id = e.id
  ) AS predictions_count,

  (
    SELECT COUNT(DISTINCT mp.user_id)
    FROM match_predictions mp
    WHERE mp.event_id = e.id
  ) AS participants_count

FROM events e
WHERE e.guild_id = ?
ORDER BY e.id DESC
      `,
            [guildId]
        );

        io.emit('dashboard:refresh', {
            slug
        });

        res.json({
            guildId,
            events,
            stats: {
                totalEvents: events.length,
                activeEvents: events.filter(e => e.status === 'active').length,
                closedEvents: events.filter(e => e.status === 'closed').length,
                archivedEvents: events.filter(e => e.status === 'archived').length
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

function getPublicCountdown(startTimeUtc) {
    if (!startTimeUtc) return 'TBA';

    const target = new Date(startTimeUtc).getTime();
    const diff = target - Date.now();

    if (diff <= 0) return 'LIVE';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(
        (diff % (1000 * 60 * 60)) / (1000 * 60)
    );

    if (hours <= 0) return `${minutes}m`;

    return `${hours}h ${minutes}m`;
}

function formatPublicDate(startTimeUtc) {
    if (!startTimeUtc) return 'Start time TBA';

    return new Date(startTimeUtc).toISOString();
}

function getPublicMatchStatus(match) {
    if (Number(match.is_locked) === 1) {
        return 'LOCKED';
    }

    const startTime = match.start_time_utc
        ? new Date(match.start_time_utc).getTime()
        : null;

    if (startTime && startTime <= Date.now()) {
        return 'LIVE';
    }

    return 'OPEN';
}

function buildPublicMatch(match) {
    let uiStatus = getPublicMatchStatus(match);

    if (match.live_status === 'FINAL') {
        uiStatus = 'FINAL';
    } else if (
        Number(match.score_a || 0) > 0 ||
        Number(match.score_b || 0) > 0
    ) {
        uiStatus = 'LIVE';
    }

    return {
        id: match.id,
        phase: match.phase,
        match_no: match.match_no,
        team_a: match.team_a,
        team_b: match.team_b,
        best_of: match.best_of,

        score_a: Number(match.score_a || 0),
        score_b: Number(match.score_b || 0),

        current_map: match.current_map || 1,
        live_status: match.live_status || null,

        start_time_utc: match.start_time_utc,
        formatted_time: formatPublicDate(match.start_time_utc),
        countdown: getPublicCountdown(match.start_time_utc),

        is_locked: Number(match.is_locked) === 1,
        ui_status: uiStatus
    };
}

app.get('/api/public/:guildSlug', async (req, res) => {
    try {
        const { guildSlug } = req.params;

        const guildId =
            guildSlug === 'hyperland'
                ? '1161660208951607397'
                : guildSlug;

        const [events] = await pool.query(
            `
            SELECT
                id,
                name,
                slug,
                phase,
                status
            FROM events
            WHERE guild_id = ?
            ORDER BY id DESC
            LIMIT 12
            `,
            [guildId]
        );

        const [[stats]] = await pool.query(
            `
    SELECT
        COUNT(DISTINCT e.id) AS events_count,
        COUNT(DISTINCT mp.user_id) AS participants,
        COUNT(mp.user_id) AS predictions
    FROM events e
    LEFT JOIN match_predictions mp
        ON mp.event_id = e.id
    WHERE e.guild_id = ?
    `,
            [guildId]
        );

        const [topPlayers] = await pool.query(
            `
    SELECT
        lb.user_id,
        SUM(lb.total_points) AS total_points
    FROM leaderboard lb
    JOIN events e
        ON e.id = lb.event_id
    WHERE e.guild_id = ?
    GROUP BY lb.user_id
    ORDER BY total_points DESC
    LIMIT 5
    `,
            [guildId]
        );

        const featuredEvent =
            events.find((e) => e.status === 'OPEN') ||
            events[0] ||
            null;

        res.json({
            guild: {
                guild_id: guildId,
                slug: guildSlug,
                name: guildId === '1161660208951607397'
                    ? 'Hyperland'
                    : guildId,
                discord_url: 'https://discord.gg/NJhspKrXNK'
            },
            stats: {
                events: Number(stats?.events_count || 0),
                participants: Number(stats?.participants || 0),
                predictions: Number(stats?.predictions || 0),
                top_players: topPlayers,
            },
            featured_event: featuredEvent,
            events
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/public/:slug/overview', async (req, res) => {
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

        const [leaderboard] = await pool.query(
            `
  SELECT
    user_id,
    total_points
  FROM leaderboard
  WHERE event_id = ?
  ORDER BY total_points DESC
  LIMIT 10
  `,
            [event.id]
        );

        const [matches] = await pool.query(
            `
  SELECT
  m.id,
  m.phase,
  m.match_no,
  m.team_a,
  m.team_b,
  m.best_of,
  m.start_time_utc,
  m.is_locked,

  COALESCE(lms.score_a, 0) AS score_a,
  COALESCE(lms.score_b, 0) AS score_b,
  lms.current_map,
  lms.status AS live_status,

  CASE
    WHEN m.is_locked = 1 THEN 'LOCKED'
    ELSE 'OPEN'
  END AS ui_status

FROM matches m
LEFT JOIN live_match_scores lms
  ON lms.match_id = m.id
WHERE m.event_id = ?
ORDER BY m.match_no ASC, m.id ASC
LIMIT 8
  `,
            [event.id]
        );

        const [[stats]] = await pool.query(
            `
  SELECT
    COUNT(*) AS matches
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

        const publicMatches = matches.map(buildPublicMatch);

        const featuredMatch =
            publicMatches.find((match) => match.ui_status === 'LIVE') ||
            publicMatches.find((match) => match.ui_status === 'OPEN') ||
            publicMatches[0] ||
            null;

        res.json({
            event,
            stats: {
                participants: predictionStats?.participants || 0,
                predictions: predictionStats?.predictions || 0,
                matches: stats?.matches || 0,
                phase: event.phase
            },
            leaderboard,
            featured_match: featuredMatch,
            matches: publicMatches
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/guilds/:guildId/meta', async (req, res) => {
    try {
        const { guildId } = req.params;

        res.json({
            guild: {
                id: guildId,
                name: 'Hyperland',
                icon: null,
                description: 'Competitive CS Pick\'Em Community'
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/guilds/:guildId/events', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { name, slug } = req.body;

        if (!name || !slug) {
            return res.status(400).json({
                error: 'Name and slug are required'
            });
        }

        const [result] = await pool.query(
            `
      INSERT INTO events (
        guild_id,
        name,
        slug,
        phase,
        status
      )
      VALUES (?, ?, ?, 'NOT_STARTED', 'open')
      `,
            [guildId, name, slug]
        );

        res.json({
            ok: true,
            event: {
                id: result.insertId,
                guild_id: guildId,
                name,
                slug,
                phase: 'NOT_STARTED',
                status: 'OPEN'
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/events/:slug/recalculate', async (req, res) => {
    try {
        const { slug } = req.params;

        const [[event]] = await pool.query(
            `
      SELECT *
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

        await calculateScores(
            event.guild_id,
            event.id
        );

        io.emit('dashboard:refresh', {
            slug
        });

        res.json({
            success: true,
            guild_id: event.guild_id,
            event_id: event.id
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Failed to recalculate scores'
        });
    }
});

app.post('/api/matches/:matchId/lock', async (req, res) => {
    try {
        const { matchId } = req.params;
        const { locked } = req.body;

        const [result] = await pool.query(
            `
      UPDATE matches
      SET is_locked = ?
      WHERE id = ?
      LIMIT 1
      `,
            [locked ? 1 : 0, matchId]
        );

        if (result.affectedRows === 0) {
            const [[match]] = await pool.query(
                `
  SELECT e.slug
  FROM matches m
  JOIN events e ON e.id = m.event_id
  WHERE m.id = ?
  LIMIT 1
  `,
                [matchId]
            );
            return res.status(404).json({
                error: 'Match not found'
            });
        }

        if (match?.slug) {
            io.emit('match:updated', {
                slug: match.slug,
                matchId,
                locked: !!locked
            });
        }

        const [[match]] = await pool.query(
            `
  SELECT e.slug
  FROM matches m
  JOIN events e
    ON e.id = m.event_id
  WHERE m.id = ?
  LIMIT 1
  `,
            [matchId]
        );

        if (match?.slug) {
            io.emit('dashboard:refresh', {
                slug: match.slug
            });
        }

        res.json({
            ok: true,
            matchId,
            locked: !!locked
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/matches/:matchId/stats', async (req, res) => {
    try {
        const { matchId } = req.params;

        const [[match]] = await pool.query(
            `
      SELECT id, team_a, team_b
      FROM matches
      WHERE id = ?
      LIMIT 1
      `,
            [matchId]
        );

        if (!match) {
            return res.status(404).json({
                error: 'Match not found'
            });
        }

        const [[stats]] = await pool.query(
            `
  SELECT
    COUNT(*) AS predictions,
    SUM(pred_a = 1) AS team_a_picks,
    SUM(pred_b = 1) AS team_b_picks
  FROM match_predictions
  WHERE match_id = ?
  `,
            [matchId]
        );

        res.json({
            match,
            stats: {
                predictions: stats?.predictions || 0,
                team_a_picks: stats?.team_a_picks || 0,
                team_b_picks: stats?.team_b_picks || 0
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/dev/matches/:matchId/score', async (req, res) => {
    try {
        const { matchId } = req.params;
        const { score_a, score_b } = req.body;

        await pool.query(
            `
  INSERT INTO live_match_scores (match_id, score_a, score_b)
  VALUES (?, ?, ?)
  ON DUPLICATE KEY UPDATE
    score_a = VALUES(score_a),
    score_b = VALUES(score_b),
    updated_at = CURRENT_TIMESTAMP
  `,
            [matchId, score_a, score_b]
        );

        io.emit('match:score_updated', {
            matchId: Number(matchId),
            score_a: Number(score_a),
            score_b: Number(score_b),
            current_map: 1,
            live_status: 'LIVE',
            ui_status: 'LIVE'
        });

        res.json({
            ok: true,
            matchId: Number(matchId),
            score_a: Number(score_a),
            score_b: Number(score_b)
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Score update failed'
        });
    }
});

app.post('/api/dev/matches/:matchId/final', async (req, res) => {
    try {
        const { matchId } = req.params;

        await pool.query(
            `
            UPDATE live_match_scores
            SET status = 'FINAL',
                updated_at = CURRENT_TIMESTAMP
            WHERE match_id = ?
            `,
            [matchId]
        );

        const [[liveScore]] = await pool.query(
            `
    SELECT score_a, score_b, current_map
    FROM live_match_scores
    WHERE match_id = ?
    LIMIT 1
    `,
            [matchId]
        );

        io.emit('match:score_updated', {
            matchId: Number(matchId),

            score_a: Number(liveScore?.score_a || 0),
            score_b: Number(liveScore?.score_b || 0),

            current_map: Number(liveScore?.current_map || 1),

            live_status: 'FINAL',
            ui_status: 'FINAL'
        });

        res.json({
            ok: true,
            matchId: Number(matchId),
            status: 'FINAL'
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Final update failed'
        });
    }
});

app.get('/api/public/servers', async (req, res) => {
    try {
        const [servers] = await pool.query(
            `
    SELECT
        e.guild_id,
        COUNT(*) AS events_count,
        SUM(e.status = 'OPEN') AS open_events,
        MAX(e.id) AS latest_event_id
    FROM events e
    WHERE e.guild_id IS NOT NULL
    GROUP BY e.guild_id
    ORDER BY events_count DESC
    `
        );

        const [featuredEvents] = await pool.query(
            `
    SELECT
        e.id,
        e.name,
        e.slug,
        e.phase,
        e.status,
        e.guild_id
    FROM events e
    ORDER BY e.id DESC
    LIMIT 6
    `
        );

        res.json({
            servers: servers.map((server) => ({
                guild_id: server.guild_id,
                name:
                    server.guild_id === '1161660208951607397'
                        ? 'Hyperland'
                        : server.guild_id,
                slug:
                    server.guild_id === '1161660208951607397'
                        ? 'hyperland'
                        : server.guild_id,
                events_count: Number(server.events_count || 0),
                open_events: Number(server.open_events),
                featured_events: featuredEvents,
                discord_url: 'https://discord.gg/NJhspKrXNK'
            }))
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        })
    }
})

app.get('/api/public/:guildSlug', async (req, res) => {
    try {
        const { guildSlug } = req.params;

        const guildId =
            guildSlug === 'hyperland'
                ? '1161660208951607397'
                : guildSlug;

        const [events] = await pool.query(
            `
            SELECT
                id,
                name,
                slug,
                phase,
                status
            FROM events
            WHERE guild_id = ?
            ORDER BY id DESC
            LIMIT 12
            `,
            [guildId]
        );

        const featuredEvent =
            events.find((e) => e.status === 'OPEN') ||
            events[0] ||
            null;

        res.json({
            guild: {
                guild_id: guildId,
                slug: guildSlug,
                name:
                    guildId === '1161660208951607397'
                        ? 'Hyperland'
                        : guildId,
                discord_url: 'https://discord.gg/NJhspKrXNK'
            },

            featured_event: featuredEvent,

            events
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/public/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const [[stats]] = await pool.query(
            `
            SELECT
                user_id,
                SUM(points) AS total_points,
                COUNT(*) AS prediction_count
            FROM match_points
            WHERE user_id = ?
            GROUP BY user_id
            LIMIT 1
            `,
            [userId]
        );

        const [recentPredictions] = await pool.query(
            `
            SELECT
    mp.match_id,
    mp.pred_a,
    mp.pred_b,
    m.team_a,
    m.team_b,
    mp.updated_at,
                e.name AS event_name,
                e.slug AS event_slug
            FROM match_predictions mp
            JOIN matches m
                ON m.id = mp.match_id
            JOIN events e
                ON e.id = mp.event_id
            WHERE mp.user_id = ?
            ORDER BY mp.updated_at DESC
            LIMIT 10
            `,
            [userId]
        );

        const [[accuracyStats]] = await pool.query(
            `
    SELECT
        COUNT(*) AS finished_predictions,
        SUM(
            CASE
                WHEN lms.status = 'FINAL'
                 AND (
                    (mp.pred_exact_a > mp.pred_exact_b AND lms.score_a > lms.score_b)
                    OR
                    (mp.pred_exact_b > mp.pred_exact_a AND lms.score_b > lms.score_a)
                 )
                THEN 1 ELSE 0
            END
        ) AS correct_winners,
        SUM(
            CASE
                WHEN lms.status = 'FINAL'
                 AND mp.pred_exact_a = lms.score_a
                 AND mp.pred_exact_b = lms.score_b
                THEN 1 ELSE 0
            END
        ) AS exact_scores
    FROM match_predictions mp
    JOIN live_match_scores lms
        ON lms.match_id = mp.match_id
    WHERE mp.user_id = ?
    `,
            [userId]
        );

        res.json({
            profile: {
                user_id: userId,
                total_points: Number(stats?.total_points || 0),
                prediction_count: Number(stats?.prediction_count || 0),
                finished_predictions: Number(accuracyStats?.finished_predictions || 0),
                correct_winners: Number(accuracyStats?.correct_winners || 0),
                exact_scores: Number(accuracyStats?.exact_scores || 0),
                accuracy:
                    Number(accuracyStats?.finished_predictions || 0) > 0
                        ? Math.round(
                            (Number(accuracyStats?.correct_winners || 0) /
                                Number(accuracyStats?.finished_predictions || 0)) * 100
                        )
                        : 0
            },

            recent_predictions: recentPredictions
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/public/matches/:matchId/prediction', async (req, res) => {
    try {
        const { matchId } = req.params;
        const { winner, score_a, score_b } = req.body;
        const user_id = req.session?.user?.id;

        if (!user_id) {
            return res.status(401).json({
                error: 'Login required'
            });
        }

        if (!['team_a', 'team_b'].includes(winner)) {
            return res.status(400).json({
                error: 'Invalid winner'
            });
        }

        const scoreA = Number(score_a);
        const scoreB = Number(score_b);

        if (
            !Number.isInteger(scoreA) ||
            !Number.isInteger(scoreB) ||
            scoreA < 0 ||
            scoreB < 0 ||
            scoreA === scoreB
        ) {
            return res.status(400).json({
                error: 'Invalid score'
            });
        }

        if (
            (winner === 'team_a' && scoreA <= scoreB) ||
            (winner === 'team_b' && scoreB <= scoreA)
        ) {
            return res.status(400).json({
                error: 'Winner does not match score'
            });
        }

        const [[match]] = await pool.query(
            `
            SELECT id, guild_id, event_id, team_a, team_b, is_locked
            FROM matches
            WHERE id = ?
            LIMIT 1
            `,
            [matchId]
        );

        if (!match) {
            return res.status(404).json({
                error: 'Match not found'
            });
        }

        if (Number(match.is_locked) === 1) {
            return res.status(403).json({
                error: 'Match is locked'
            });
        }

        const predA = winner === 'team_a' ? 1 : 0;
        const predB = winner === 'team_b' ? 1 : 0;

        await pool.query(
            `
            INSERT INTO match_predictions (
                match_id,
                guild_id,
                event_id,
                user_id,
                pred_a,
                pred_b,
                pred_exact_a,
                pred_exact_b
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                pred_a = VALUES(pred_a),
                pred_b = VALUES(pred_b),
                pred_exact_a = VALUES(pred_exact_a),
                pred_exact_b = VALUES(pred_exact_b),
                updated_at = CURRENT_TIMESTAMP
            `,
            [
                match.id,
                match.guild_id,
                match.event_id,
                user_id,
                predA,
                predB,
                scoreA,
                scoreB
            ]
        );

        res.json({
            ok: true,
            prediction: {
                match_id: Number(matchId),
                user_id,
                winner,
                score_a: Number(score_a),
                score_b: Number(score_b)
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Prediction save failed'
        });
    }
});

app.get('/api/public/matches/:matchId/prediction/:userId', async (req, res) => {
    try {
        const { matchId, userId } = req.params;

        const [[prediction]] = await pool.query(
            `
            SELECT
                match_id,
                user_id,
                pred_a,
                pred_b,
                pred_exact_a,
                pred_exact_b
            FROM match_predictions
            WHERE match_id = ?
              AND user_id = ?
            LIMIT 1
            `,
            [matchId, userId]
        );

        if (!prediction) {
            return res.json({
                prediction: null
            });
        }

        res.json({
            prediction: {
                match_id: prediction.match_id,
                user_id: prediction.user_id,
                winner: Number(prediction.pred_a) === 1 ? 'team_a' : 'team_b',
                score_a: prediction.pred_exact_a,
                score_b: prediction.pred_exact_b
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Prediction load failed'
        });
    }
});

app.get('/api/public/events/:eventId/predictions/:userId', async (req, res) => {
    try {
        const { eventId, userId } = req.params;

        const [rows] = await pool.query(
            `
            SELECT
                match_id,
                user_id,
                pred_a,
                pred_b,
                pred_exact_a,
                pred_exact_b
            FROM match_predictions
            WHERE event_id = ?
              AND user_id = ?
            `,
            [eventId, userId]
        );

        res.json({
            predictions: rows.map((row) => ({
                match_id: row.match_id,
                user_id: row.user_id,
                winner: Number(row.pred_a) === 1 ? 'team_a' : 'team_b',
                score_a: row.pred_exact_a,
                score_b: row.pred_exact_b
            }))
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Predictions load failed'
        });
    }
});

app.get('/api/public/me/predictions', async (req, res) => {
    try {
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: 'Login required'
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                mp.match_id,
                mp.pred_a,
                mp.pred_b,
                mp.pred_exact_a,
                mp.pred_exact_b,
                m.team_a,
                m.team_b,
                m.phase,
                m.best_of,
                m.is_locked,
                m.score_a,
                m.score_b,
                m.ui_status
                e.name AS event_name,
                e.slug AS event_slug
            FROM match_predictions mp
            JOIN matches m ON m.id = mp.match_id
            JOIN events e ON e.id = mp.event_id
            WHERE mp.user_id = ?
            ORDER BY mp.updated_at DESC
            `,
            [userId]
        );

        res.json({
            predictions: rows.map((row) => ({
                match_id: row.match_id,
                winner: Number(row.pred_a) === 1 ? 'team_a' : 'team_b',
                score_a: row.pred_exact_a,
                score_b: row.pred_exact_b,
                team_a: row.team_a,
                team_b: row.team_b,
                phase: row.phase,
                best_of: row.best_of,
                actual_score_a: row.score_a,
                actual_score_b: row.score_b,
                match_status: row.ui_status,
                is_locked: Number(row.is_locked) === 1,
                event_name: row.event_name,
                event_slug: row.event_slug,
                is_correct_winner:
                    row.ui_status === 'FINAL'
                        ? (
                            (Number(row.pred_exact_a) > Number(row.pred_exact_b) &&
                                Number(row.score_a) > Number(row.score_b)) ||

                            (Number(row.pred_exact_b) > Number(row.pred_exact_a) &&
                                Number(row.score_b) > Number(row.score_a))
                        )
                        : null,
                is_exact_score:
                    row.ui_status === 'FINAL'
                        ? (
                            Number(row.pred_exact_a) === Number(row.score_a) &&
                            Number(row.pred_exact_b) === Number(row.score_b)
                        )
                        : null,
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Predictions load failed' });
    }
});

app.get('/api/public/leaderboard', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                mp.user_id,

                COUNT(*) AS total_predictions,

                SUM(
                    CASE
                        WHEN m.ui_status = 'FINAL'
                         AND (
                            (mp.pred_exact_a > mp.pred_exact_b AND m.score_a > m.score_b)
                            OR
                            (mp.pred_exact_b > mp.pred_exact_a AND m.score_b > m.score_a)
                         )
                        THEN 1 ELSE 0
                    END
                ) AS correct_winners,

                SUM(
                    CASE
                        WHEN m.ui_status = 'FINAL'
                         AND mp.pred_exact_a = m.score_a
                         AND mp.pred_exact_b = m.score_b
                        THEN 1 ELSE 0
                    END
                ) AS exact_scores,

                COALESCE(SUM(ms.points), 0) AS total_points

            FROM match_predictions mp

            LEFT JOIN matches m
                ON m.id = mp.match_id

            LEFT JOIN match_scores ms
                ON ms.match_id = mp.match_id
               AND ms.user_id = mp.user_id

            GROUP BY mp.user_id

            ORDER BY total_points DESC, correct_winners DESC

            LIMIT 100
        `);

        const leaderboard = rows.map((row, index) => {
            const finishedPredictions =
                Number(row.correct_winners || 0);

            const totalPredictions =
                Number(row.total_predictions || 0);

            return {
                rank: index + 1,
                user_id: row.user_id,
                total_points: Number(row.total_points || 0),
                total_predictions: totalPredictions,
                correct_winners: Number(row.correct_winners || 0),
                exact_scores: Number(row.exact_scores || 0),
                accuracy:
                    totalPredictions > 0
                        ? Math.round(
                            (Number(row.correct_winners || 0) /
                                totalPredictions) * 100
                        )
                        : 0
            };
        });

        res.json({ leaderboard });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Leaderboard load failed'
        });
    }
});

app.get('/api/public/events/:slug/swiss-pickem', async (req, res) => {
    try {
        const userId = req.session?.user?.id || null;
        const { slug } = req.params;

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id, name, slug, phase, status
            FROM events
            WHERE slug = ?
            LIMIT 1
            `,
            [slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const [teams] = await pool.query(
            `
            SELECT id, name
            FROM teams
            WHERE guild_id = ?
              AND active = 1
            ORDER BY name ASC
            `,
            [event.guild_id]
        );

        let prediction = null;

        if (userId) {
            const [[row]] = await pool.query(
                `
                SELECT
                    pick_3_0,
                    pick_0_3,
                    advancing
                FROM swiss_predictions
                WHERE event_id = ?
                  AND user_id = ?
                LIMIT 1
                `,
                [event.id, userId]
            );

            if (row) {
                prediction = {
                    three_zero: row.pick_3_0
                        ? row.pick_3_0.split(',')
                        : [],

                    zero_three: row.pick_0_3
                        ? row.pick_0_3.split(',')
                        : [],

                    advancing: row.advancing
                        ? row.advancing.split(',')
                        : []
                };
            }
        }

        res.json({
            event,
            teams,
            prediction
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Swiss pickem load failed' });
    }
});

app.post('/api/public/events/:slug/swiss-pickem', async (req, res) => {
    try {
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: 'Login required'
            });
        }

        const { slug } = req.params;
        const { three_zero, zero_three, advancing } = req.body;

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id, name, slug, phase, status
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

        const threeZero = Array.isArray(three_zero) ? three_zero : [];
        const zeroThree = Array.isArray(zero_three) ? zero_three : [];
        const advancingTeams = Array.isArray(advancing) ? advancing : [];

        if (threeZero.length !== 2) {
            return res.status(400).json({
                error: 'Pick exactly 2 teams for 3-0'
            });
        }

        if (zeroThree.length !== 2) {
            return res.status(400).json({
                error: 'Pick exactly 2 teams for 0-3'
            });
        }

        if (advancingTeams.length !== 6) {
            return res.status(400).json({
                error: 'Pick exactly 6 advancing teams'
            });
        }

        const allPicked = [
            ...threeZero,
            ...zeroThree,
            ...advancingTeams
        ];

        const uniquePicked = new Set(allPicked);

        if (uniquePicked.size !== allPicked.length) {
            return res.status(400).json({
                error: 'Team can only be selected once'
            });
        }

        await pool.query(
            `
    INSERT INTO swiss_predictions (
        guild_id,
        event_id,
        user_id,
        username,
        displayname,
        pick_3_0,
        pick_0_3,
        advancing,
        active,
        submitted_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
        username = VALUES(username),
        displayname = VALUES(displayname),
        pick_3_0 = VALUES(pick_3_0),
        pick_0_3 = VALUES(pick_0_3),
        advancing = VALUES(advancing),
        active = 1,
        submitted_at = CURRENT_TIMESTAMP
    `,
            [
                event.guild_id,
                event.id,
                userId,
                req.session.user?.username || userId,
                req.session.user?.global_name || req.session.user?.username || userId,
                threeZero.join(','),
                zeroThree.join(','),
                advancingTeams.join(',')
            ]
        );

        res.json({
            ok: true,
            prediction: {
                three_zero: threeZero,
                zero_three: zeroThree,
                advancing: advancingTeams
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Swiss pickem save failed'
        });
    }
});

httpServer.listen(3301, () => {
    console.log('WEB SERWER DZIAŁA NA http://localhost:3301');
});

startCs2LogReceiver({
    port: Number(process.env.CS2_LOG_PORT || 27500),
    onLine(raw) {
        const parsed = parseCs2LogLine(raw);

        if (!parsed) return;

        console.log('[CS2 PARSED]', parsed);
    }
});