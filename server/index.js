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
import path from 'path'

const require = createRequire(import.meta.url);
const calculateScores = require('../handlers/matches/calculateScores');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');
const guildRegistry = require('../utils/guildRegistry');
const fs = require('fs')

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMINISTRATOR_PERMISSION = 0x8n;

const app = express();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: WEB_ORIGIN,
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log('Frontend connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Frontend disconnected:', socket.id);
    });
});

function parseCsvPick(value) {
    if (!value) return [];

    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

app.use(cors({
    origin: WEB_ORIGIN,
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

// Discord's permission bitfield can exceed 32 bits, so it must be compared as a BigInt.
function hasAdminPermission(user, guildId) {
    if (!user || !guildId) return false;
    const guild = (user.guilds || []).find(g => g.id === String(guildId));
    if (!guild) return false;

    try {
        return (BigInt(guild.permissions) & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION;
    } catch {
        return false;
    }
}

function isGuildMember(user, guildId) {
    if (!user || !guildId) return false;
    return (user.guilds || []).some(g => g.id === String(guildId));
}

// resolveGuildId(req) -> guildId | Promise<guildId>; runs after the login check so it can safely query the DB.
function requireGuildAdmin(resolveGuildId) {
    return async (req, res, next) => {
        const user = req.session?.user;

        if (!user) {
            return res.status(401).json({ error: 'Login required' });
        }

        try {
            const guildId = await resolveGuildId(req);

            if (!guildId) {
                return res.status(404).json({ error: 'Not found' });
            }

            if (!hasAdminPermission(user, guildId)) {
                return res.status(403).json({ error: 'Admin permission required for this server' });
            }

            req.guildId = String(guildId);
            next();
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Authorization check failed' });
        }
    };
}

async function guildIdFromEventSlug(req) {
    const [[event]] = await pool.query(
        'SELECT guild_id FROM events WHERE slug = ? LIMIT 1',
        [req.params.slug]
    );
    return event?.guild_id || null;
}

async function guildIdFromMatchId(req) {
    const [[match]] = await pool.query(
        'SELECT guild_id FROM matches WHERE id = ? LIMIT 1',
        [req.params.matchId]
    );
    return match?.guild_id || null;
}

app.get('/api/auth/me', (req, res) => {
    res.json({
        user: req.session?.user || null
    });
});

app.get('/api/auth/discord', (req, res) => {
    console.log('[AUTH] Discord login start');

    req.session.returnTo = req.query.returnTo || '/public';

    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
            return res.status(500).send('Session save failed');
        }

        const params = new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            redirect_uri: process.env.DISCORD_REDIRECT_URI,
            response_type: 'code',
            scope: 'identify guilds'
        });

        const url = `https://discord.com/oauth2/authorize?${params.toString()}`;

        console.log('[AUTH] returnTo query:', req.query.returnTo);
        console.log('[AUTH] returnTo saved:', req.session.returnTo);

        res.redirect(url);
    });
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

        // Needed to know which guilds the user can administer (used by hasAdminPermission/isGuildMember).
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const discordGuilds = guildsResponse.ok ? await guildsResponse.json() : [];

        if (!guildsResponse.ok) {
            console.error('Discord guilds fetch failed:', await guildsResponse.text().catch(() => ''));
        }

        req.session.user = {
            id: discordUser.id,
            username: discordUser.username,
            global_name: discordUser.global_name,
            avatar: discordUser.avatar,
            guilds: Array.isArray(discordGuilds)
                ? discordGuilds.map(g => ({ id: g.id, name: g.name, permissions: g.permissions }))
                : []
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).send('Session save failed');
            }

            const returnTo = req.session.returnTo || '/public';
            delete req.session.returnTo;

            res.redirect(`${WEB_ORIGIN}${returnTo}`);
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('OAuth callback failed');
    }
});

if (!IS_PRODUCTION) {
    // Dev-only login shortcut. Never enable in production - it logs anyone in as a real Discord account with no credentials.
    app.get('/api/auth/dev-login', (req, res) => {
        req.session.user = {
            id: '461851082570596352',
            username: 'cieplyhehe',
            global_name: 'cieplyhehe',
            avatar: null,
            guilds: guildRegistry.getAllGuildIds().map(id => ({
                id,
                name: id,
                permissions: String(ADMINISTRATOR_PERMISSION)
            }))
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).send('Session save failed');
            }

            res.redirect(`${WEB_ORIGIN}/public`);
        });
    });
}

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
        e.id,
        e.name,
        e.slug,
        e.phase,
        e.status,

        (
          SELECT COUNT(DISTINCT mp.user_id)
          FROM match_predictions mp
          WHERE mp.event_id = e.id
        ) AS participants,

        (
          SELECT COUNT(*)
          FROM match_predictions mp
          WHERE mp.event_id = e.id
        ) AS predictions,

        (
          SELECT ap.deadline
          FROM active_panels ap
          WHERE ap.guild_id COLLATE utf8mb4_unicode_ci = e.guild_id
            AND ap.phase COLLATE utf8mb4_unicode_ci = e.phase
            AND ap.active = 1
            AND ap.deadline IS NOT NULL
          ORDER BY ap.deadline ASC
          LIMIT 1
        ) AS deadline

      FROM events e
      WHERE e.is_active = 1
        AND e.is_archived = 0
      ORDER BY e.id DESC
    `);

        res.json({
            events: rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB error' });
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

app.post('/api/events/:slug/status', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
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

app.get('/api/guilds', (req, res) => {
    const user = req.session?.user;

    if (!user) {
        return res.status(401).json({ error: 'Login required' });
    }

    const knownGuildIds = new Set(guildRegistry.getAllGuildIds());

    const guilds = (user.guilds || [])
        .filter(g => knownGuildIds.has(g.id) && hasAdminPermission(user, g.id))
        .map(g => ({ id: g.id, name: g.name, role: 'admin' }));

    res.json({ guilds });
});

app.get('/api/guilds/:guildId/events', requireGuildAdmin(req => req.params.guildId), async (req, res) => {
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

app.get('/api/public/archives', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
            SELECT
                id,
                guild_id,
                filename,
                created_at
            FROM archive_files
            ORDER BY created_at DESC
            `
        );

        res.json(rows);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Failed to load archives'
        });
    }
});

// Known-guild display name/invite mapping - there's no real per-guild name/slug/invite
// storage anywhere (config/*.env only has DB credentials), so only the one guild we
// have real data for gets a friendly name and real Discord invite. Others fall back
// to their raw guild_id and no invite link, rather than showing a wrong one.
const KNOWN_GUILDS = {
    '1161660208951607397': {
        slug: 'hyperland',
        name: 'Hyperland',
        discord_url: 'https://discord.gg/NJhspKrXNK'
    }
};

app.get('/api/public/servers', async (req, res) => {
    try {
        const [servers] = await pool.query(
            `
    SELECT
        e.guild_id,
        COUNT(*) AS events_count,
        SUM(e.status = 'OPEN') AS open_events
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
            servers: servers.map((server) => {
                const known = KNOWN_GUILDS[server.guild_id];

                return {
                    guild_id: server.guild_id,
                    name: known?.name || server.guild_id,
                    slug: known?.slug || server.guild_id,
                    events_count: Number(server.events_count || 0),
                    open_events: Number(server.open_events || 0),
                    discord_url: known?.discord_url || null
                };
            }),
            featured_events: featuredEvents
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/public/:guildSlug', async (req, res) => {
    try {
        const { guildSlug } = req.params;

        const guildId =
            guildSlug === 'hyperland'
                ? '1161660208951607397'
                : guildSlug;

        const known = KNOWN_GUILDS[guildId];

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
                slug: known?.slug || guildId,
                name: known?.name || guildId,
                discord_url: known?.discord_url || null
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
  guild_id,
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

app.post('/api/guilds/:guildId/events', requireGuildAdmin(req => req.params.guildId), async (req, res) => {
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

app.post('/api/events/:slug/recalculate', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
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

app.post('/api/matches/:matchId/lock', requireGuildAdmin(guildIdFromMatchId), async (req, res) => {
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
            return res.status(404).json({
                error: 'Match not found'
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
            io.emit('match:updated', {
                slug: match.slug,
                matchId,
                locked: !!locked
            });

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
            SELECT id, team_a, team_b, best_of
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
                SUM(pred_a > pred_b) AS team_a_picks,
                SUM(pred_b > pred_a) AS team_b_picks
            FROM match_predictions
            WHERE match_id = ?
            `,
            [matchId]
        );

        const [seriesRows] = await pool.query(
            `
            SELECT
                pred_a,
                pred_b,
                COUNT(*) AS picks
            FROM match_predictions
            WHERE match_id = ?
            GROUP BY pred_a, pred_b
            ORDER BY picks DESC
            `,
            [matchId]
        );

        const [bo1MapRows] = await pool.query(
            `
            SELECT
                1 AS map_no,
                pred_exact_a,
                pred_exact_b,
                COUNT(*) AS picks
            FROM match_predictions
            WHERE match_id = ?
              AND pred_exact_a IS NOT NULL
              AND pred_exact_b IS NOT NULL
            GROUP BY pred_exact_a, pred_exact_b
            `,
            [matchId]
        );

        const [multiMapRows] = await pool.query(
            `
            SELECT
                map_no,
                pred_exact_a,
                pred_exact_b,
                COUNT(*) AS picks
            FROM match_map_predictions
            WHERE match_id = ?
              AND pred_exact_a IS NOT NULL
              AND pred_exact_b IS NOT NULL
            GROUP BY map_no, pred_exact_a, pred_exact_b
            ORDER BY map_no ASC, picks DESC
            `,
            [matchId]
        );

        const bestOf = Number(match.best_of || 1);
        const mapRows = bestOf === 1 ? bo1MapRows : multiMapRows;

        const mapBreakdownMap = new Map();

        for (const row of mapRows) {
            const mapNo = Number(row.map_no);

            if (!mapBreakdownMap.has(mapNo)) {
                mapBreakdownMap.set(mapNo, []);
            }

            mapBreakdownMap.get(mapNo).push({
                map_no: mapNo,
                pred_exact_a: Number(row.pred_exact_a),
                pred_exact_b: Number(row.pred_exact_b),
                score: `${row.pred_exact_a}:${row.pred_exact_b}`,
                picks: Number(row.picks || 0)
            });
        }

        const map_breakdown = [...mapBreakdownMap.entries()].map(
            ([map_no, scores]) => ({
                map_no,
                scores: scores
                    .sort((a, b) => b.picks - a.picks)
                    .slice(0, 5)
            })
        );

        res.json({
            match,
            stats: {
                predictions: Number(stats?.predictions || 0),
                team_a_picks: Number(stats?.team_a_picks || 0),
                team_b_picks: Number(stats?.team_b_picks || 0),

                series_breakdown: seriesRows.map((row) => ({
                    pred_a: Number(row.pred_a),
                    pred_b: Number(row.pred_b),
                    label:
                        Number(row.pred_a) > Number(row.pred_b)
                            ? `${match.team_a} ${row.pred_a}:${row.pred_b}`
                            : `${match.team_b} ${row.pred_b}:${row.pred_a}`,
                    score: `${row.pred_a}:${row.pred_b}`,
                    picks: Number(row.picks || 0)
                })),

                map_breakdown
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/dev/matches/:matchId/score', requireGuildAdmin(guildIdFromMatchId), async (req, res) => {
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

app.post('/api/dev/matches/:matchId/final', requireGuildAdmin(guildIdFromMatchId), async (req, res) => {
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

app.get('/api/public/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const [[profileStats]] = await pool.query(
            `
            SELECT
                user_id,
                displayname,
                total_points,
                swiss_points,
                playoffs_points,
                playin_points,
                doubleelim_points,
                match_points,
                correct_series,
                correct_maps,
                exact_maps,
                updated_at
            FROM user_total_scores
            WHERE user_id = ?
            LIMIT 1
            `,
            [userId]
        );

        const [[rankRow]] = await pool.query(
            `
            SELECT ranked.rank_position
            FROM (
                SELECT
                    user_id,
                    RANK() OVER (ORDER BY total_points DESC) AS rank_position
                FROM user_total_scores
            ) ranked
            WHERE ranked.user_id = ?
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
                mp.pred_exact_a,
                mp.pred_exact_b,
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

        const [swissPicks] = await pool.query(
            `
    SELECT
        sp.stage,
        sp.pick_3_0,
        sp.pick_0_3,
        sp.advancing,
        sp.submitted_at,
        e.name AS event_name,
        e.slug AS event_slug
    FROM swiss_predictions sp
    JOIN events e
        ON e.id = sp.event_id
    WHERE sp.user_id = ?
      AND sp.active = 1
    ORDER BY sp.submitted_at DESC
    LIMIT 12
    `,
            [userId]
        );

        const [eventPerformances] = await pool.query(
            `
    SELECT
        e.id AS event_id,
        e.name AS event_name,
        e.slug AS event_slug,

        SUM(combined.total_points) AS total_points,
        SUM(combined.swiss_points) AS swiss_points,
        SUM(combined.match_points) AS match_points,
        SUM(combined.playoffs_points) AS playoffs_points,
        SUM(combined.playin_points) AS playin_points,
        SUM(combined.doubleelim_points) AS doubleelim_points

    FROM (
        SELECT
            event_id,
            user_id,
            COALESCE(points, 0) AS total_points,
            COALESCE(points, 0) AS swiss_points,
            0 AS match_points,
            0 AS playoffs_points,
            0 AS playin_points,
            0 AS doubleelim_points
        FROM swiss_scores

        UNION ALL

        SELECT
            event_id,
            user_id,
            COALESCE(points, 0) AS total_points,
            0 AS swiss_points,
            COALESCE(points, 0) AS match_points,
            0 AS playoffs_points,
            0 AS playin_points,
            0 AS doubleelim_points
        FROM match_points

        UNION ALL

        SELECT
            event_id,
            user_id,
            COALESCE(points, score, 0) AS total_points,
            0 AS swiss_points,
            0 AS match_points,
            COALESCE(points, score, 0) AS playoffs_points,
            0 AS playin_points,
            0 AS doubleelim_points
        FROM playoffs_scores

        UNION ALL

        SELECT
            event_id,
            user_id,
            COALESCE(points, 0) AS total_points,
            0 AS swiss_points,
            0 AS match_points,
            0 AS playoffs_points,
            COALESCE(points, 0) AS playin_points,
            0 AS doubleelim_points
        FROM playin_scores

        UNION ALL

        SELECT
            event_id,
            user_id,
            COALESCE(points, 0) AS total_points,
            0 AS swiss_points,
            0 AS match_points,
            0 AS playoffs_points,
            0 AS playin_points,
            COALESCE(points, 0) AS doubleelim_points
        FROM doubleelim_scores
    ) combined

    JOIN events e
        ON e.id = combined.event_id

    WHERE combined.user_id = ?

    GROUP BY e.id, e.name, e.slug

    ORDER BY total_points DESC, e.id DESC

    LIMIT 10
    `,
            [userId]
        );

        res.json({
            profile: {
                user_id: userId,
                displayname: profileStats?.displayname || userId,

                rank: Number(rankRow?.rank_position || 0),

                total_points: Number(profileStats?.total_points || 0),
                swiss_points: Number(profileStats?.swiss_points || 0),
                playoffs_points: Number(profileStats?.playoffs_points || 0),
                playin_points: Number(profileStats?.playin_points || 0),
                doubleelim_points: Number(profileStats?.doubleelim_points || 0),
                match_points: Number(profileStats?.match_points || 0),

                correct_series: Number(profileStats?.correct_series || 0),
                correct_maps: Number(profileStats?.correct_maps || 0),
                exact_maps: Number(profileStats?.exact_maps || 0),

                prediction_count: recentPredictions.length,

                finished_predictions: Number(accuracyStats?.finished_predictions || 0),
                correct_winners: Number(accuracyStats?.correct_winners || 0),
                exact_scores: Number(accuracyStats?.exact_scores || 0),

                accuracy:
                    Number(accuracyStats?.finished_predictions || 0) > 0
                        ? Math.round(
                            (Number(accuracyStats?.correct_winners || 0) /
                                Number(accuracyStats?.finished_predictions || 0)) * 100
                        )
                        : 0,

                updated_at: profileStats?.updated_at || null
            },

            recent_predictions: recentPredictions.map((prediction) => ({
                ...prediction,
                winner:
                    Number(prediction.pred_a) === 1
                        ? prediction.team_a
                        : prediction.team_b,
                score:
                    prediction.pred_exact_a !== null && prediction.pred_exact_b !== null
                        ? `${prediction.pred_exact_a}:${prediction.pred_exact_b}`
                        : `${prediction.pred_a}:${prediction.pred_b}`
            })),

            swiss_picks: swissPicks.map((pick) => ({
                stage: pick.stage,
                event_name: pick.event_name,
                event_slug: pick.event_slug,
                submitted_at: pick.submitted_at,
                three_zero: parseCsvPick(pick.pick_3_0),
                zero_three: parseCsvPick(pick.pick_0_3),
                advancing: parseCsvPick(pick.advancing)
            })),

            event_performances: eventPerformances.map((event) => ({
                event_id: event.event_id,
                event_name: event.event_name,
                event_slug: event.event_slug,
                total_points: Number(event.total_points || 0),
                swiss_points: Number(event.swiss_points || 0),
                match_points: Number(event.match_points || 0),
                playoffs_points: Number(event.playoffs_points || 0),
                playin_points: Number(event.playin_points || 0),
                doubleelim_points: Number(event.doubleelim_points || 0)
            }))
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
        const user_id = req.session?.user?.id;

        if (!user_id) {
            return res.status(401).json({
                error: 'Login required'
            });
        }

        const [[match]] = await pool.query(
            `
            SELECT id, guild_id, event_id, team_a, team_b, best_of, is_locked
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

        if (!isGuildMember(req.session.user, match.guild_id)) {
            return res.status(403).json({
                error: 'You are not a member of this server'
            });
        }

        if (Number(match.is_locked) === 1) {
            return res.status(403).json({
                error: 'Match is locked'
            });
        }

        const bestOf = Number(match.best_of || 1);

        let predA = null;
        let predB = null;
        let bo1ExactA = null;
        let bo1ExactB = null;
        let mapPicks = [];

        if (req.body?.series) {
            predA = Number(req.body.series.pred_a);
            predB = Number(req.body.series.pred_b);

            if (
                !Number.isInteger(predA) ||
                !Number.isInteger(predB) ||
                predA < 0 ||
                predB < 0 ||
                predA === predB
            ) {
                return res.status(400).json({
                    error: 'Invalid series prediction'
                });
            }

            if (bestOf === 1) {
                const validBo1 =
                    (predA === 1 && predB === 0) ||
                    (predA === 0 && predB === 1);

                if (!validBo1) {
                    return res.status(400).json({
                        error: 'BO1 series must be 1:0 or 0:1'
                    });
                }
            }

            if (bestOf === 3) {
                const validBo3 =
                    (predA === 2 && (predB === 0 || predB === 1)) ||
                    (predB === 2 && (predA === 0 || predA === 1));

                if (!validBo3) {
                    return res.status(400).json({
                        error: 'BO3 series must be 2:0 / 2:1 / 1:2 / 0:2'
                    });
                }
            }

            if (bestOf === 5) {
                const validBo5 =
                    (predA === 3 && [0, 1, 2].includes(predB)) ||
                    (predB === 3 && [0, 1, 2].includes(predA));

                if (!validBo5) {
                    return res.status(400).json({
                        error: 'BO5 series must be 3:x or x:3'
                    });
                }
            }

            mapPicks = Array.isArray(req.body.maps) ? req.body.maps : [];

            for (const map of mapPicks) {
                const mapNo = Number(map.map_no);
                const exactA = Number(map.pred_exact_a);
                const exactB = Number(map.pred_exact_b);

                if (
                    !Number.isInteger(mapNo) ||
                    mapNo < 1 ||
                    mapNo > bestOf ||
                    !Number.isInteger(exactA) ||
                    !Number.isInteger(exactB) ||
                    exactA < 0 ||
                    exactB < 0 ||
                    exactA > 99 ||
                    exactB > 99 ||
                    exactA === exactB
                ) {
                    return res.status(400).json({
                        error: `Invalid map prediction for map ${mapNo || '?'}`
                    });
                }

                if (bestOf === 1 && mapNo === 1) {
                    bo1ExactA = exactA;
                    bo1ExactB = exactB;
                }
            }
        } else {
            const { winner, score_a, score_b } = req.body;

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

            predA = winner === 'team_a' ? 1 : 0;
            predB = winner === 'team_b' ? 1 : 0;
            bo1ExactA = scoreA;
            bo1ExactB = scoreB;
        }

        await pool.query('START TRANSACTION');

        try {
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
                    bestOf === 1 ? bo1ExactA : null,
                    bestOf === 1 ? bo1ExactB : null
                ]
            );

            if (bestOf > 1) {
                await pool.query(
                    `
                    DELETE FROM match_map_predictions
                    WHERE guild_id = ?
                      AND event_id = ?
                      AND match_id = ?
                      AND user_id = ?
                    `,
                    [match.guild_id, match.event_id, match.id, user_id]
                );

                const values = mapPicks.map((map) => [
                    match.id,
                    match.guild_id,
                    match.event_id,
                    user_id,
                    Number(map.map_no),
                    null,
                    Number(map.pred_exact_a),
                    Number(map.pred_exact_b)
                ]);

                if (values.length) {
                    await pool.query(
                        `
                        INSERT INTO match_map_predictions (
                            match_id,
                            guild_id,
                            event_id,
                            user_id,
                            map_no,
                            pred,
                            pred_exact_a,
                            pred_exact_b
                        )
                        VALUES ?
                        `,
                        [values]
                    );
                }
            }

            await pool.query('COMMIT');
        } catch (err) {
            await pool.query('ROLLBACK');
            throw err;
        }

        res.json({
            ok: true,
            prediction: {
                match_id: Number(matchId),
                user_id,
                series: {
                    pred_a: predA,
                    pred_b: predB
                },
                maps: bestOf === 1
                    ? [
                        {
                            map_no: 1,
                            pred_exact_a: bo1ExactA,
                            pred_exact_b: bo1ExactB
                        }
                    ]
                    : mapPicks.map((map) => ({
                        map_no: Number(map.map_no),
                        pred_exact_a: Number(map.pred_exact_a),
                        pred_exact_b: Number(map.pred_exact_b)
                    }))
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

        const [[match]] = await pool.query(
            `
            SELECT id, best_of
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

        let maps = [];

        if (Number(match.best_of) === 1) {
            maps = [
                {
                    map_no: 1,
                    pred_exact_a: prediction.pred_exact_a,
                    pred_exact_b: prediction.pred_exact_b
                }
            ];
        } else {
            const [mapRows] = await pool.query(
                `
                SELECT
                    map_no,
                    pred_exact_a,
                    pred_exact_b
                FROM match_map_predictions
                WHERE match_id = ?
                  AND user_id = ?
                ORDER BY map_no ASC
                `,
                [matchId, userId]
            );

            maps = mapRows.map((row) => ({
                map_no: Number(row.map_no),
                pred_exact_a: row.pred_exact_a,
                pred_exact_b: row.pred_exact_b
            }));
        }

        res.json({
            prediction: {
                match_id: prediction.match_id,
                user_id: prediction.user_id,

                winner:
                    Number(prediction.pred_a) > Number(prediction.pred_b)
                        ? 'team_a'
                        : 'team_b',

                score_a: prediction.pred_exact_a,
                score_b: prediction.pred_exact_b,

                series: {
                    pred_a: Number(prediction.pred_a),
                    pred_b: Number(prediction.pred_b)
                },

                maps
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
                mp.match_id,
                mp.user_id,
                mp.pred_a,
                mp.pred_b,
                mp.pred_exact_a,
                mp.pred_exact_b,
                m.best_of
            FROM match_predictions mp
            JOIN matches m
              ON m.id = mp.match_id
            WHERE mp.event_id = ?
              AND mp.user_id = ?
            `,
            [eventId, userId]
        );

        const [mapRows] = await pool.query(
            `
            SELECT
                match_id,
                map_no,
                pred_exact_a,
                pred_exact_b
            FROM match_map_predictions
            WHERE event_id = ?
              AND user_id = ?
            ORDER BY match_id ASC, map_no ASC
            `,
            [eventId, userId]
        );

        const mapsByMatch = new Map();

        for (const row of mapRows) {
            const matchId = Number(row.match_id);

            if (!mapsByMatch.has(matchId)) {
                mapsByMatch.set(matchId, []);
            }

            mapsByMatch.get(matchId).push({
                map_no: Number(row.map_no),
                pred_exact_a: row.pred_exact_a,
                pred_exact_b: row.pred_exact_b
            });
        }

        res.json({
            predictions: rows.map((row) => {
                const bestOf = Number(row.best_of || 1);

                const maps =
                    bestOf === 1
                        ? [
                            {
                                map_no: 1,
                                pred_exact_a: row.pred_exact_a,
                                pred_exact_b: row.pred_exact_b
                            }
                        ]
                        : mapsByMatch.get(Number(row.match_id)) || [];

                return {
                    match_id: row.match_id,
                    user_id: row.user_id,

                    winner:
                        Number(row.pred_a) > Number(row.pred_b)
                            ? 'team_a'
                            : 'team_b',

                    score_a: row.pred_exact_a,
                    score_b: row.pred_exact_b,

                    series: {
                        pred_a: Number(row.pred_a),
                        pred_b: Number(row.pred_b)
                    },

                    maps
                };
            })
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

app.get('/api/public/events/:slug/swiss-pickem/:stage', async (req, res) => {
    try {
        const userId = req.session?.user?.id || null;
        const { slug } = req.params;

        const { stage } = req.params;

        if (!['stage1', 'stage2', 'stage3'].includes(stage)) {
            return res.status(400).json({
                error: 'Invalid Swiss stage'
            });
        }

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

        const gate = await assertPredictionsAllowed({
            guildId: event.guild_id,
            kind: 'SWISS',
            stage
        });

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
                  AND stage = ?
                LIMIT 1
                `,
                [event.id, userId, stage]
            );

            if (row) {
                prediction = {
                    three_zero: parseCsvPick(row.pick_3_0),
                    zero_three: parseCsvPick(row.pick_0_3),
                    advancing: parseCsvPick(row.advancing)
                };
            }
        }

        res.json({
            event,
            teams,
            prediction,
            lock: {
                allowed: gate.allowed,
                message: gate.message || null
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Swiss pickem load failed' });
    }
});

app.post('/api/public/events/:slug/swiss-pickem/:stage', async (req, res) => {
    try {
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: 'Login required'
            });
        }

        const { slug } = req.params;

        const { stage } = req.params;

        if (!['stage1', 'stage2', 'stage3'].includes(stage)) {
            return res.status(400).json({
                error: 'Invalid Swiss stage'
            });
        }

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

        if (!isGuildMember(req.session.user, event.guild_id)) {
            return res.status(403).json({
                error: 'You are not a member of this server'
            });
        }

        const gate = await assertPredictionsAllowed({
            guildId: event.guild_id,
            kind: 'SWISS',
            stage
        });

        if (!gate.allowed) {
            return res.status(403).json({
                error: gate.message || "Pick'Em is closed for this stage."
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
        console.log({
            eventId: event.id,
            phase: event.phase,
            userId
        });
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

app.get('/api/public/events/:slug/leaderboard', async (req, res) => {
    try {
        const { slug } = req.params;

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id, name, slug
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
                combined.user_id,
                MAX(combined.displayname) AS displayname,

                SUM(combined.total_points) AS total_points,
                SUM(combined.swiss_points) AS swiss_points,
                SUM(combined.playoffs_points) AS playoffs_points,
                SUM(combined.playin_points) AS playin_points,
                SUM(combined.doubleelim_points) AS doubleelim_points,
                SUM(combined.match_points) AS match_points

            FROM (
                SELECT
                    user_id,
                    displayname,
                    COALESCE(points, 0) AS total_points,
                    COALESCE(points, 0) AS swiss_points,
                    0 AS playoffs_points,
                    0 AS playin_points,
                    0 AS doubleelim_points,
                    0 AS match_points
                FROM swiss_scores
                WHERE event_id = ?

                UNION ALL

                SELECT
                    user_id,
                    displayname,
                    COALESCE(points, score, 0) AS total_points,
                    0 AS swiss_points,
                    COALESCE(points, score, 0) AS playoffs_points,
                    0 AS playin_points,
                    0 AS doubleelim_points,
                    0 AS match_points
                FROM playoffs_scores
                WHERE event_id = ?

                UNION ALL

                SELECT
                    user_id,
                    displayname,
                    COALESCE(points, 0) AS total_points,
                    0 AS swiss_points,
                    0 AS playoffs_points,
                    COALESCE(points, 0) AS playin_points,
                    0 AS doubleelim_points,
                    0 AS match_points
                FROM playin_scores
                WHERE event_id = ?

                UNION ALL

                SELECT
                    user_id,
                    displayname,
                    COALESCE(points, 0) AS total_points,
                    0 AS swiss_points,
                    0 AS playoffs_points,
                    0 AS playin_points,
                    COALESCE(points, 0) AS doubleelim_points,
                    0 AS match_points
                FROM doubleelim_scores
                WHERE event_id = ?

                UNION ALL

                SELECT
                    user_id,
                    NULL AS displayname,
                    COALESCE(points, 0) AS total_points,
                    0 AS swiss_points,
                    0 AS playoffs_points,
                    0 AS playin_points,
                    0 AS doubleelim_points,
                    COALESCE(points, 0) AS match_points
                FROM match_points
                WHERE event_id = ?
            ) combined

            WHERE combined.user_id IS NOT NULL

            GROUP BY combined.user_id

            ORDER BY total_points DESC, swiss_points DESC, match_points DESC

            LIMIT 100
            `,
            [event.id, event.id, event.id, event.id, event.id]
        );

        res.json({
            event,
            leaderboard: rows.map((row, index) => ({
                rank: index + 1,
                user_id: row.user_id,
                displayname: row.displayname || row.user_id,
                total_points: Number(row.total_points || 0),
                swiss_points: Number(row.swiss_points || 0),
                playoffs_points: Number(row.playoffs_points || 0),
                playin_points: Number(row.playin_points || 0),
                doubleelim_points: Number(row.doubleelim_points || 0),
                match_points: Number(row.match_points || 0)
            }))
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Event leaderboard load failed'
        });
    }
});

app.get('/api/public/events/:slug/swiss-stats/:stage', async (req, res) => {
    try {
        const { slug, stage } = req.params;

        if (!['stage1', 'stage2', 'stage3'].includes(stage)) {
            return res.status(400).json({
                error: 'Invalid Swiss stage'
            });
        }

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id, name, slug
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
            SELECT pick_3_0, pick_0_3, advancing
            FROM swiss_predictions
            WHERE event_id = ?
              AND stage = ?
              AND active = 1
            `,
            [event.id, stage]
        );

        function countCsvValues(values) {
            const counts = new Map();

            values.forEach((value) => {
                if (!value) return;

                String(value)
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .forEach((team) => {
                        counts.set(team, (counts.get(team) || 0) + 1);
                    });
            });

            return [...counts.entries()]
                .map(([team, count]) => ({
                    team,
                    count,
                    percentage: rows.length > 0
                        ? Math.round((count / rows.length) * 100)
                        : 0
                }))
                .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
        }

        res.json({
            event,
            stage,
            total_predictions: rows.length,
            stats: {
                three_zero: countCsvValues(rows.map((row) => row.pick_3_0)),
                zero_three: countCsvValues(rows.map((row) => row.pick_0_3)),
                advancing: countCsvValues(rows.map((row) => row.advancing))
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Swiss stats load failed'
        });
    }
});

app.get('/api/public/events/:slug/match-stats', async (req, res) => {
    try {
        const { slug } = req.params;

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id, name, slug
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
        m.id AS match_id,
        m.match_no,
        m.phase,
        m.team_a,
        m.team_b,
        m.best_of,
        m.start_time_utc,

        mr.res_a,
        mr.res_b,
        mr.finished_at,

        COUNT(mp.user_id) AS total_predictions,

        COALESCE(SUM(mp.pred_a = 1), 0) AS team_a_picks,
        COALESCE(SUM(mp.pred_b = 1), 0) AS team_b_picks

    FROM matches m

    LEFT JOIN match_results mr
        ON mr.match_id = m.id

    LEFT JOIN match_predictions mp
        ON mp.match_id = m.id

    WHERE m.event_id = ?

    GROUP BY
        m.id,
        m.match_no,
        m.phase,
        m.team_a,
        m.team_b,
        m.best_of,
        m.start_time_utc,
        mr.res_a,
        mr.res_b,
        mr.finished_at

    ORDER BY m.match_no ASC, m.id ASC
    `,
            [event.id]
        );

        const [scoreRows] = await pool.query(
            `
    SELECT
        mp.match_id,
        mp.pred_exact_a,
        mp.pred_exact_b,
        COUNT(*) AS picks
    FROM match_predictions mp
    JOIN matches m
        ON m.id = mp.match_id
    WHERE m.event_id = ?
      AND mp.pred_exact_a IS NOT NULL
      AND mp.pred_exact_b IS NOT NULL
    GROUP BY
        mp.match_id,
        mp.pred_exact_a,
        mp.pred_exact_b
    ORDER BY picks DESC
    `,
            [event.id]
        );

        const scoreMap = new Map();

        scoreRows.forEach((row) => {
            const matchId = Number(row.match_id);

            if (!scoreMap.has(matchId)) {
                scoreMap.set(matchId, []);
            }

            scoreMap.get(matchId).push({
                score: `${row.pred_exact_a}:${row.pred_exact_b}`,
                picks: Number(row.picks || 0)
            });
        });

        res.json({
            event,
            matches: rows.map((row) => {
                const total = Number(row.total_predictions || 0);
                const teamAPicks = Number(row.team_a_picks || 0);
                const teamBPicks = Number(row.team_b_picks || 0);

                const winner =
                    row.finished_at
                        ? Number(row.res_a) > Number(row.res_b)
                            ? row.team_a
                            : row.team_b
                        : null;

                const communityPick =
                    teamAPicks >= teamBPicks
                        ? row.team_a
                        : row.team_b;

                return {
                    match_id: row.match_id,
                    match_no: row.match_no,
                    phase: row.phase,
                    team_a: row.team_a,
                    team_b: row.team_b,
                    best_of: row.best_of,
                    start_time_utc: row.start_time_utc,

                    result_a: row.res_a !== null ? Number(row.res_a) : null,
                    result_b: row.res_b !== null ? Number(row.res_b) : null,
                    finished_at: row.finished_at,

                    total_predictions: total,

                    team_a_picks: teamAPicks,
                    team_b_picks: teamBPicks,

                    team_a_percentage:
                        total > 0 ? Math.round((teamAPicks / total) * 100) : 0,

                    team_b_percentage:
                        total > 0 ? Math.round((teamBPicks / total) * 100) : 0,

                    community_pick: communityPick,
                    winner,

                    community_was_right: winner
                        ? communityPick === winner
                        : null,

                    top_scores: (scoreMap.get(Number(row.match_id)) || []).slice(0, 3)
                };
            })
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Match stats load failed'
        });
    }
});

app.get('/api/public/events/:slug/playin-pickem', async (req, res) => {
    try {
        const userId = req.session?.user?.id || null;
        const { slug } = req.params;

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id, name, slug, status
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

        const gate = await assertPredictionsAllowed({
            guildId: event.guild_id,
            kind: 'PLAYIN'
        });

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
                SELECT teams
                FROM playin_predictions
                WHERE event_id = ?
                  AND user_id = ?
                  AND active = 1
                LIMIT 1
                `,
                [event.id, userId]
            );

            if (row) {
                prediction = {
                    teams: parseCsvPick(row.teams)
                };
            }
        }

        res.json({
            event,
            teams,
            prediction,
            lock: {
                allowed: gate.allowed,
                message: gate.message || null
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Play-In PickEm load failed'
        });
    }
});

app.post('/api/public/events/:slug/playin-pickem', async (req, res) => {
    try {
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: 'Login required'
            });
        }

        const { slug } = req.params;
        const { teams } = req.body;

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id, name, slug, status
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

        if (!isGuildMember(req.session.user, event.guild_id)) {
            return res.status(403).json({
                error: 'You are not a member of this server'
            });
        }

        const gate = await assertPredictionsAllowed({
            guildId: event.guild_id,
            kind: 'PLAYIN'
        });

        if (!gate.allowed) {
            return res.json(403).json({
                error: gate.message || "Play-In Pick'Em is closed."
            })
        }

        const selectedTeams = Array.isArray(teams) ? teams : [];

        if (selectedTeams.length !== 8) {
            return res.status(400).json({
                error: 'Pick exactly 8 Play-In teams'
            });
        }

        if (new Set(selectedTeams).size !== selectedTeams.length) {
            return res.status(400).json({
                error: 'Team can only be selected once'
            });
        }

        const [validTeamsRows] = await pool.query(
            `
            SELECT name
            FROM teams
            WHERE guild_id = ?
              AND active = 1
            `,
            [event.guild_id]
        );

        const validTeams = new Set(validTeamsRows.map((team) => team.name));

        const invalidTeams = selectedTeams.filter(
            (team) => !validTeams.has(team)
        );

        if (invalidTeams.length > 0) {
            return res.status(400).json({
                error: `Invalid teams: ${invalidTeams.join(', ')}`
            });
        }

        await pool.query(
            `
            INSERT INTO playin_predictions (
                guild_id,
                event_id,
                user_id,
                username,
                displayname,
                teams,
                active,
                submitted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                username = VALUES(username),
                displayname = VALUES(displayname),
                teams = VALUES(teams),
                active = 1,
                submitted_at = CURRENT_TIMESTAMP
            `,
            [
                event.guild_id,
                event.id,
                userId,
                req.session.user?.username || userId,
                req.session.user?.global_name || req.session.user?.username || userId,
                selectedTeams.join(', ')
            ]
        );

        res.json({
            ok: true,
            prediction: {
                teams: selectedTeams
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Play-In PickEm save failed'
        });
    }
});

app.get('/api/public/events/:slug/playoffs-pickem', async (req, res) => {
    try {
        const userId = req.session?.user?.id || null;
        const { slug } = req.params;

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id, name, slug, status
            FROM events
            WHERE slug = ?
            LIMIT 1
            `,
            [slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const gate = await assertPredictionsAllowed({
            guildId: event.guild_id,
            kind: 'PLAYOFFS'
        });

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
                SELECT semifinalists, finalists, winner, third_place_winner
                FROM playoffs_predictions
                WHERE event_id = ?
                  AND user_id = ?
                  AND active = 1
                LIMIT 1
                `,
                [event.id, userId]
            );

            if (row) {
                prediction = {
                    semifinalists: parseCsvPick(row.semifinalists),
                    finalists: parseCsvPick(row.finalists),
                    winner: row.winner || null,
                    third_place_winner: row.third_place_winner || null
                };
            }
        }

        res.json({
            event,
            teams,
            prediction,
            lock: {
                allowed: gate.allowed,
                message: gate.message || null
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Playoffs PickEm load failed' });
    }
});

app.post('/api/public/events/:slug/playoffs-pickem', async (req, res) => {
    try {
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Login required' });
        }

        const { slug } = req.params;
        const {
            semifinalists,
            finalists,
            winner,
            third_place_winner
        } = req.body;

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id, name, slug, status
            FROM events
            WHERE slug = ?
            LIMIT 1
            `,
            [slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (!isGuildMember(req.session.user, event.guild_id)) {
            return res.status(403).json({
                error: 'You are not a member of this server'
            });
        }

        const gate = await assertPredictionsAllowed({
            guildId: event.guild_id,
            kind: 'PLAYOFFS'
        });

        if (!gate.allowed) {
            return res.status(403).json({
                error: gate.message || "Playoffs Pick'Em is closed."
            });
        }

        const semifinalistsPick = Array.isArray(semifinalists) ? semifinalists : [];
        const finalistsPick = Array.isArray(finalists) ? finalists : [];

        if (semifinalistsPick.length !== 4) {
            return res.status(400).json({ error: 'Pick exactly 4 semifinalists' });
        }

        if (finalistsPick.length !== 2) {
            return res.status(400).json({ error: 'Pick exactly 2 finalists' });
        }

        if (!winner) {
            return res.status(400).json({ error: 'Pick tournament winner' });
        }

        if (!third_place_winner) {
            return res.status(400).json({ error: 'Pick third place winner' });
        }

        const [validTeamsRows] = await pool.query(
            `
            SELECT name
            FROM teams
            WHERE guild_id = ?
              AND active = 1
            `,
            [event.guild_id]
        );

        const validTeams = new Set(validTeamsRows.map((team) => team.name));

        const allPicked = [
            ...semifinalistsPick,
            ...finalistsPick,
            winner,
            third_place_winner
        ];

        const invalidTeams = allPicked.filter((team) => !validTeams.has(team));

        if (invalidTeams.length > 0) {
            return res.status(400).json({
                error: `Invalid teams: ${invalidTeams.join(', ')}`
            });
        }

        const finalistsMustBeSemifinalists = finalistsPick.every((team) =>
            semifinalistsPick.includes(team)
        );

        if (!finalistsMustBeSemifinalists) {
            return res.status(400).json({
                error: 'Finalists must be selected from semifinalists'
            });
        }

        if (!finalistsPick.includes(winner)) {
            return res.status(400).json({
                error: 'Winner must be selected from finalists'
            });
        }

        if (!semifinalistsPick.includes(third_place_winner)) {
            return res.status(400).json({
                error: 'Third place winner must be selected from semifinalists'
            });
        }

        if (winner === third_place_winner) {
            return res.status(400).json({
                error: 'Winner and third place winner cannot be the same team'
            });
        }

        await pool.query(
            `
            INSERT INTO playoffs_predictions (
                guild_id,
                event_id,
                user_id,
                username,
                displayname,
                semifinalists,
                finalists,
                winner,
                third_place_winner,
                active,
                submitted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                username = VALUES(username),
                displayname = VALUES(displayname),
                semifinalists = VALUES(semifinalists),
                finalists = VALUES(finalists),
                winner = VALUES(winner),
                third_place_winner = VALUES(third_place_winner),
                active = 1,
                submitted_at = CURRENT_TIMESTAMP
            `,
            [
                event.guild_id,
                event.id,
                userId,
                req.session.user?.username || userId,
                req.session.user?.global_name || req.session.user?.username || userId,
                semifinalistsPick.join(', '),
                finalistsPick.join(', '),
                winner,
                third_place_winner
            ]
        );

        res.json({
            ok: true,
            prediction: {
                semifinalists: semifinalistsPick,
                finalists: finalistsPick,
                winner,
                third_place_winner
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Playoffs PickEm save failed' });
    }
});

app.get('/api/public/events/:slug/doubleelim-pickem', async (req, res) => {
    try {
        const userId = req.session?.user?.id || null;
        const { slug } = req.params;

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id, name, slug, status
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

        const gate = await assertPredictionsAllowed({
            guildId: event.guild_id,
            kind: 'DOUBLEELIM'
        });

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
                    upper_final_a,
                    lower_final_a,
                    upper_final_b,
                    lower_final_b
                FROM doubleelim_predictions
                WHERE event_id = ?
                  AND user_id = ?
                  AND active = 1
                LIMIT 1
                `,
                [event.id, userId]
            );

            if (row) {
                prediction = {
                    upper_final_a: parseCsvPick(row.upper_final_a),
                    lower_final_a: parseCsvPick(row.lower_final_a),
                    upper_final_b: parseCsvPick(row.upper_final_b),
                    lower_final_b: parseCsvPick(row.lower_final_b)
                };
            }
        }

        res.json({
            event,
            teams,
            prediction,
            lock: {
                allowed: gate.allowed,
                message: gate.message || null
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Double Elim PickEm load failed'
        });
    }
});

app.post('/api/public/events/:slug/doubleelim-pickem', async (req, res) => {
    try {
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: 'Login required'
            });
        }

        const { slug } = req.params;

        const {
            upper_final_a,
            lower_final_a,
            upper_final_b,
            lower_final_b
        } = req.body;

        const [[event]] = await pool.query(
            `
            SELECT id, guild_id
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

        if (!isGuildMember(req.session.user, event.guild_id)) {
            return res.status(403).json({
                error: 'You are not a member of this server'
            });
        }

        const gate = await assertPredictionsAllowed({
            guildId: event.guild_id,
            kind: 'DOUBLEELIM'
        });

        if (!gate.allowed) {
            return res.status(403).json({
                error: gate.message || "Double Elim Pick'Em is closed."
            });
        }

        const ufa = Array.isArray(upper_final_a) ? upper_final_a : [];
        const lfa = Array.isArray(lower_final_a) ? lower_final_a : [];
        const ufb = Array.isArray(upper_final_b) ? upper_final_b : [];
        const lfb = Array.isArray(lower_final_b) ? lower_final_b : [];

        if (
            ufa.length !== 2 ||
            lfa.length !== 2 ||
            ufb.length !== 2 ||
            lfb.length !== 2
        ) {
            return res.status(400).json({
                error: 'Each bracket must contain exactly 2 teams'
            });
        }

        const [validTeamsRows] = await pool.query(
            `
            SELECT name
            FROM teams
            WHERE guild_id = ?
              AND active = 1
            `,
            [event.guild_id]
        );

        const validTeams = new Set(
            validTeamsRows.map((team) => team.name)
        );

        const allTeams = [
            ...ufa,
            ...lfa,
            ...ufb,
            ...lfb
        ];

        const invalidTeams = allTeams.filter(
            (team) => !validTeams.has(team)
        );

        if (invalidTeams.length > 0) {
            return res.status(400).json({
                error: `Invalid teams: ${invalidTeams.join(', ')}`
            });
        }

        await pool.query(
            `
            INSERT INTO doubleelim_predictions (
                guild_id,
                event_id,
                user_id,
                username,
                displayname,
                upper_final_a,
                lower_final_a,
                upper_final_b,
                lower_final_b,
                active,
                submitted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                username = VALUES(username),
                displayname = VALUES(displayname),
                upper_final_a = VALUES(upper_final_a),
                lower_final_a = VALUES(lower_final_a),
                upper_final_b = VALUES(upper_final_b),
                lower_final_b = VALUES(lower_final_b),
                active = 1,
                submitted_at = CURRENT_TIMESTAMP
            `,
            [
                event.guild_id,
                event.id,
                userId,
                req.session.user?.username || userId,
                req.session.user?.global_name ||
                req.session.user?.username ||
                userId,
                ufa.join(', '),
                lfa.join(', '),
                ufb.join(', '),
                lfb.join(', ')
            ]
        );

        res.json({
            ok: true
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Double Elim PickEm save failed'
        });
    }
});



app.get('/api/public/archives/:id/download', async (req, res) => {
    try {
        const { id } = req.params;

        const [[archive]] = await pool.query(
            `
            SELECT *
            FROM archive_files
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (!archive) {
            return res.status(404).json({
                error: 'Archive not found'
            });
        }

        const dbPath = archive.path;

        const rebuiltPath = path.join(
            process.cwd(),
            'archiwum',
            String(archive.guild_id),
            archive.filename
        );

        const finalPath = fs.existsSync(dbPath)
            ? dbPath
            : rebuiltPath;

        console.log('[archive download]', {
            id,
            filename: archive.filename,
            dbPath,
            rebuiltPath,
            existsDbPath: fs.existsSync(dbPath),
            existsRebuiltPath: fs.existsSync(rebuiltPath),
            cwd: process.cwd()
        });

        if (!fs.existsSync(finalPath)) {
            return res.status(404).json({
                error: 'Archive file missing',
                filename: archive.filename,
                dbPath,
                rebuiltPath,
                cwd: process.cwd()
            });
        }

        return res.download(finalPath, archive.filename);
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Download failed'
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