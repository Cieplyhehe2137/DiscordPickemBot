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
import MySQLStoreFactory from 'express-mysql-session';
import path from 'path'

const require = createRequire(import.meta.url);
const calculateScores = require('../handlers/matches/calculateScores');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');
const guildRegistry = require('../utils/guildRegistry');
const teamsStore = require('../utils/teamsStore');
const matchesStore = require('../utils/matchesStore');
const recalculateMatchPoints = require('../services/recalculateMatchPoints');
const { runInTransaction } = require('../utils/runInTransaction');
const exportClassification = require('../handlers/admin/exportClassification');
const { logWarn } = require('../utils/logger');
const { loadActiveTeams } = require('../utils/loadActiveTeams');
const { getCurrentSwissResults } = require('../utils/swissRepository');
const { getCurrentPlayoffs } = require('../utils/playoffsRepository');
const { getCurrentDoubleElimResults } = require('../utils/doubleelimRepository');
const { getCurrentPlayinResults } = require('../utils/playinRepository');
const { maxMapsFromBo } = require('../utils/mapLabels');
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

const MySQLStore = MySQLStoreFactory(session);

// Table is created manually (see migrations/README.md) rather than via
// createDatabaseTable, so schema changes stay reviewable like everything
// else touching the shared production database.
const sessionStore = new MySQLStore({ createDatabaseTable: false }, pool);

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'pickem-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: IS_PRODUCTION,
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

app.get('/api/guilds/:guildId/teams', requireGuildAdmin(req => req.params.guildId), async (req, res) => {
    try {
        const { guildId } = req.params;
        const includeInactive = req.query.includeInactive === '1';

        const teams = await teamsStore.listTeams(guildId, { includeInactive });

        res.json({ guildId, teams });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/guilds/:guildId/teams', requireGuildAdmin(req => req.params.guildId), async (req, res) => {
    try {
        const { guildId } = req.params;
        const { name, shortName } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({
                error: 'Team name is required'
            });
        }

        await teamsStore.addTeam(guildId, name, { shortName: shortName || null });

        const teams = await teamsStore.listTeams(guildId, { includeInactive: true });
        const team = teams.find(t => t.name === String(name).trim().replace(/\s+/g, ' '));

        res.json({ ok: true, team });
    } catch (err) {
        if (err?.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'A team with this name already exists on this server'
            });
        }

        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.patch('/api/guilds/:guildId/teams/:teamId', requireGuildAdmin(req => req.params.guildId), async (req, res) => {
    try {
        const { guildId, teamId } = req.params;
        const { name, shortName, active } = req.body;

        if (name !== undefined) {
            await teamsStore.renameTeam(guildId, teamId, name, { shortName: shortName ?? null });
        }

        if (active !== undefined) {
            const teams = await teamsStore.listTeams(guildId, { includeInactive: true });
            const current = teams.find(t => String(t.id) === String(teamId));

            if (current && Boolean(current.active) !== Boolean(active)) {
                await teamsStore.toggleTeamActive(guildId, teamId);
            }
        }

        const teams = await teamsStore.listTeams(guildId, { includeInactive: true });
        const team = teams.find(t => String(t.id) === String(teamId));

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        res.json({ ok: true, team });
    } catch (err) {
        if (err?.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'A team with this name already exists on this server'
            });
        }

        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.delete('/api/guilds/:guildId/teams/:teamId', requireGuildAdmin(req => req.params.guildId), async (req, res) => {
    try {
        const { guildId, teamId } = req.params;

        const teams = await teamsStore.listTeams(guildId, { includeInactive: true });
        const team = teams.find(t => String(t.id) === String(teamId));

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const [[usage]] = await pool.query(
            `
            SELECT COUNT(*) AS count
            FROM matches
            WHERE guild_id = ?
              AND (team_a = ? OR team_b = ?)
            `,
            [guildId, team.name, team.name]
        );

        if (usage.count > 0) {
            return res.status(409).json({
                error: `Cannot delete "${team.name}" - it is referenced by ${usage.count} match(es). Deactivate it instead.`
            });
        }

        await teamsStore.deleteTeams(guildId, [teamId]);

        res.json({ ok: true, deletedId: Number(teamId) });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/guilds/:guildId/teams/reorder', requireGuildAdmin(req => req.params.guildId), async (req, res) => {
    try {
        const { guildId } = req.params;
        const { orderedIds } = req.body;

        if (!Array.isArray(orderedIds) || !orderedIds.length) {
            return res.status(400).json({
                error: 'orderedIds must be a non-empty array'
            });
        }

        await teamsStore.reorderTeams(guildId, orderedIds);

        const teams = await teamsStore.listTeams(guildId, { includeInactive: true });

        res.json({ ok: true, teams });
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

// Guild display name/slug/invite come from config/*.env (GUILD_NAME, GUILD_SLUG,
// DISCORD_INVITE_URL) - the same files guildRegistry already loads for DB credentials.
// A guild with no config file (shouldn't happen, but defensive) falls back to its
// raw guild_id and no invite link rather than showing wrong info.
function getKnownGuildInfo(guildId) {
    const cfg = guildRegistry.getGuildConfig(guildId);

    return {
        slug: cfg?.GUILD_SLUG || guildId,
        name: cfg?.GUILD_NAME || guildId,
        discord_url: cfg?.DISCORD_INVITE_URL || null
    };
}

// Resolves a URL slug (e.g. "hyperland") back to a guild_id by checking every
// known guild's GUILD_SLUG. Falls back to treating the slug as a raw guild_id
// directly, since /public/:guildSlug already supports that for guilds without
// a configured vanity slug.
function resolveGuildIdFromSlug(guildSlug) {
    for (const id of guildRegistry.getAllGuildIds()) {
        const cfg = guildRegistry.getGuildConfig(id);
        if (cfg?.GUILD_SLUG === guildSlug) return id;
    }

    return guildSlug;
}

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
                const known = getKnownGuildInfo(server.guild_id);

                return {
                    guild_id: server.guild_id,
                    name: known.name,
                    slug: known.slug,
                    events_count: Number(server.events_count || 0),
                    open_events: Number(server.open_events || 0),
                    discord_url: known.discord_url
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

        const guildId = resolveGuildIdFromSlug(guildSlug);
        const known = getKnownGuildInfo(guildId);

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
                slug: known.slug,
                name: known.name,
                discord_url: known.discord_url
            },
            stats: {
                events: Number(stats?.events_count || 0),
                participants: Number(stats?.participants || 0),
                predictions: Number(stats?.predictions || 0)
            },
            top_players: topPlayers,
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

app.post('/api/guilds/:guildId/events/:slug/matches', requireGuildAdmin(req => req.params.guildId), async (req, res) => {
    try {
        const { guildId, slug } = req.params;
        const { phase, teamA, teamB, bestOf, startTimeUtc } = req.body;

        if (!phase || !teamA || !teamB || ![1, 3, 5].includes(Number(bestOf))) {
            return res.status(400).json({
                error: 'phase, teamA, teamB and a valid bestOf (1, 3 or 5) are required'
            });
        }

        if (teamA === teamB) {
            return res.status(400).json({
                error: 'Team A and Team B must be different'
            });
        }

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const [activeTeams] = await pool.query(
            'SELECT name FROM teams WHERE guild_id = ? AND active = 1 AND name IN (?, ?)',
            [guildId, teamA, teamB]
        );

        const activeNames = new Set(activeTeams.map(t => t.name));

        if (!activeNames.has(teamA) || !activeNames.has(teamB)) {
            return res.status(400).json({
                error: 'Both teams must be active teams on this server'
            });
        }

        const [[next]] = await pool.query(
            `
            SELECT COALESCE(MAX(match_no), 0) + 1 AS nextNo
            FROM matches
            WHERE guild_id = ? AND event_id = ? AND phase = ?
            `,
            [guildId, event.id, phase]
        );

        const [result] = await pool.query(
            `
            INSERT INTO matches (
                guild_id, event_id, phase, match_no, team_a, team_b, best_of, start_time_utc, is_locked
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            `,
            [guildId, event.id, phase, next.nextNo, teamA, teamB, Number(bestOf), startTimeUtc || null]
        );

        res.json({
            ok: true,
            match: {
                id: result.insertId,
                guild_id: guildId,
                event_id: event.id,
                phase,
                match_no: next.nextNo,
                team_a: teamA,
                team_b: teamB,
                best_of: Number(bestOf),
                start_time_utc: startTimeUtc || null,
                is_locked: 0
            }
        });

        io.emit('dashboard:refresh', { slug });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/matches/:matchId/result', requireGuildAdmin(guildIdFromMatchId), async (req, res) => {
    try {
        const { matchId } = req.params;
        const { guildId } = req;
        const resA = Number(req.body.resA);
        const resB = Number(req.body.resB);

        if (!Number.isInteger(resA) || !Number.isInteger(resB) || resA < 0 || resB < 0) {
            return res.status(400).json({
                error: 'resA and resB must be non-negative integers'
            });
        }

        const match = await matchesStore.getMatchById(pool, guildId, matchId);

        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        await pool.query(
            `
            INSERT INTO match_results
                (guild_id, event_id, match_id, res_a, res_b)
            VALUES
                (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                event_id = VALUES(event_id),
                res_a = VALUES(res_a),
                res_b = VALUES(res_b)
            `,
            [guildId, match.event_id, matchId, resA, resB]
        );

        await recalculateMatchPoints(pool, guildId, match.event_id, matchId, match.best_of);

        const [[eventRow]] = await pool.query(
            'SELECT slug FROM events WHERE id = ? LIMIT 1',
            [match.event_id]
        );

        if (eventRow?.slug) {
            io.emit('dashboard:refresh', { slug: eventRow.slug });
        }

        res.json({ ok: true, matchId: Number(matchId), resA, resB });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/matches/:matchId/exact', requireGuildAdmin(guildIdFromMatchId), async (req, res) => {
    try {
        const { matchId } = req.params;
        const { guildId } = req;

        const match = await matchesStore.getMatchById(pool, guildId, matchId);

        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        const maxMaps = maxMapsFromBo(match.best_of);
        const maps = [];

        if (maxMaps === 1) {
            const [[row]] = await pool.query(
                'SELECT exact_a, exact_b FROM match_results WHERE match_id = ? AND guild_id = ? LIMIT 1',
                [matchId, guildId]
            );

            maps.push({ mapNo: 1, exactA: row?.exact_a ?? null, exactB: row?.exact_b ?? null });
        } else {
            const [rows] = await pool.query(
                'SELECT map_no, exact_a, exact_b FROM match_map_results WHERE match_id = ? AND guild_id = ?',
                [matchId, guildId]
            );

            const byMap = new Map(rows.map((r) => [Number(r.map_no), r]));

            for (let i = 1; i <= maxMaps; i += 1) {
                const r = byMap.get(i);
                maps.push({ mapNo: i, exactA: r?.exact_a ?? null, exactB: r?.exact_b ?? null });
            }
        }

        res.json({ bestOf: match.best_of, maxMaps, maps });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/matches/:matchId/exact', requireGuildAdmin(guildIdFromMatchId), async (req, res) => {
    try {
        const { matchId } = req.params;
        const { guildId } = req;

        const match = await matchesStore.getMatchById(pool, guildId, matchId);

        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        const maxMaps = maxMapsFromBo(match.best_of);
        const inputMaps = Array.isArray(req.body.maps) ? req.body.maps : [];
        const clean = [];

        for (const m of inputMaps) {
            const mapNo = Number(m.mapNo);
            const exactA = Number(m.exactA);
            const exactB = Number(m.exactB);

            if (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps) {
                return res.status(400).json({ error: `Invalid mapNo: ${m.mapNo}` });
            }

            if (!Number.isFinite(exactA) || !Number.isFinite(exactB) || exactA < 0 || exactB < 0 || exactA > 99 || exactB > 99) {
                return res.status(400).json({ error: `Map ${mapNo}: score must be a number 0-99` });
            }

            clean.push({ mapNo, exactA, exactB });
        }

        if (!clean.length) {
            return res.status(400).json({ error: 'No map scores provided' });
        }

        if (maxMaps === 1) {
            const { exactA, exactB } = clean[0];

            await pool.query(
                `
                INSERT INTO match_results (guild_id, event_id, match_id, exact_a, exact_b)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    event_id = VALUES(event_id),
                    exact_a = VALUES(exact_a),
                    exact_b = VALUES(exact_b)
                `,
                [guildId, match.event_id, matchId, exactA, exactB]
            );
        } else {
            for (const { mapNo, exactA, exactB } of clean) {
                await pool.query(
                    `
                    INSERT INTO match_map_results (guild_id, event_id, match_id, map_no, exact_a, exact_b)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        event_id = VALUES(event_id),
                        exact_a = VALUES(exact_a),
                        exact_b = VALUES(exact_b),
                        updated_at = CURRENT_TIMESTAMP
                    `,
                    [guildId, match.event_id, matchId, mapNo, exactA, exactB]
                );
            }
        }

        await recalculateMatchPoints(pool, guildId, match.event_id, matchId, match.best_of);

        const [[eventRow]] = await pool.query(
            'SELECT slug FROM events WHERE id = ? LIMIT 1',
            [match.event_id]
        );

        if (eventRow?.slug) {
            io.emit('dashboard:refresh', { slug: eventRow.slug });
        }

        res.json({ ok: true, maps: clean });
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

const SWISS_STAGES = ['stage1', 'stage2', 'stage3'];

app.get('/api/events/:slug/swiss-results/:stage', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug, stage } = req.params;
        const { guildId } = req;

        if (!SWISS_STAGES.includes(stage)) {
            return res.status(400).json({ error: 'Invalid stage' });
        }

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const current = await getCurrentSwissResults(pool, guildId, event.id, stage);

        res.json({
            x3_0: current.x3_0,
            x0_3: current.x0_3,
            advancing: current.adv
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/events/:slug/swiss-results/:stage', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug, stage } = req.params;
        const { guildId } = req;

        if (!SWISS_STAGES.includes(stage)) {
            return res.status(400).json({ error: 'Invalid stage' });
        }

        const x3_0 = Array.isArray(req.body.x3_0) ? req.body.x3_0.map(String) : [];
        const x0_3 = Array.isArray(req.body.x0_3) ? req.body.x0_3.map(String) : [];
        const advancing = Array.isArray(req.body.advancing) ? req.body.advancing.map(String) : [];

        if (x3_0.length > 2) {
            return res.status(400).json({ error: '3-0: limit 2 teams' });
        }

        if (x0_3.length > 2) {
            return res.status(400).json({ error: '0-3: limit 2 teams' });
        }

        if (advancing.length > 6) {
            return res.status(400).json({ error: 'Advancing: limit 6 teams' });
        }

        const all = [...x3_0, ...x0_3, ...advancing];

        if (new Set(all.map((v) => v.toLowerCase())).size !== all.length) {
            return res.status(400).json({ error: 'A team cannot be in more than one category' });
        }

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const teams = await loadActiveTeams(pool, guildId);
        const validTeams = new Set(teams.map((t) => t.toLowerCase()));
        const invalid = all.filter((t) => !validTeams.has(t.toLowerCase()));

        if (invalid.length) {
            return res.status(400).json({ error: `Unknown or inactive teams: ${invalid.join(', ')}` });
        }

        await pool.query(
            `
            INSERT INTO swiss_results
              (guild_id, event_id, stage, correct_3_0, correct_0_3, correct_advancing, active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
              event_id = VALUES(event_id),
              correct_3_0 = VALUES(correct_3_0),
              correct_0_3 = VALUES(correct_0_3),
              correct_advancing = VALUES(correct_advancing),
              active = 1
            `,
            [guildId, event.id, stage, x3_0.join(', '), x0_3.join(', '), advancing.join(', ')]
        );

        res.json({ ok: true, stage, x3_0, x0_3, advancing });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/events/:slug/playoffs-results', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const current = await getCurrentPlayoffs(pool, guildId, event.id);

        res.json({
            semifinalists: current.semifinalists,
            finalists: current.finalists,
            winner: current.winner[0] || null,
            third: current.third[0] || null
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/events/:slug/playoffs-results', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug } = req.params;
        const { guildId } = req;

        const semifinalists = Array.isArray(req.body.semifinalists) ? req.body.semifinalists.map(String) : [];
        const finalists = Array.isArray(req.body.finalists) ? req.body.finalists.map(String) : [];
        const winner = req.body.winner ? String(req.body.winner) : null;
        const third = req.body.third ? String(req.body.third) : null;

        if (semifinalists.length > 4) {
            return res.status(400).json({ error: 'Semifinalists: limit 4 teams' });
        }

        if (finalists.length > 2) {
            return res.status(400).json({ error: 'Finalists: limit 2 teams' });
        }

        if (finalists.some((t) => !semifinalists.includes(t))) {
            return res.status(400).json({ error: 'Finalists must be semifinalists' });
        }

        if (winner && !finalists.includes(winner)) {
            return res.status(400).json({ error: 'Winner must be a finalist' });
        }

        if (third && (third === winner || !semifinalists.includes(third))) {
            return res.status(400).json({ error: 'Invalid third place' });
        }

        const all = [...semifinalists, ...finalists, ...(winner ? [winner] : []), ...(third ? [third] : [])];

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const teams = await loadActiveTeams(pool, guildId);
        const invalid = all.filter((t) => !teams.includes(t));

        if (invalid.length) {
            return res.status(400).json({ error: `Unknown or inactive teams: ${invalid.join(', ')}` });
        }

        await runInTransaction(pool, async (conn) => {
            await conn.query(
                'UPDATE playoffs_results SET active = 0 WHERE guild_id = ? AND event_id = ?',
                [guildId, event.id]
            );

            await conn.query(
                `INSERT INTO playoffs_results
                    (guild_id, event_id, correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner, active)
                 VALUES (?, ?, ?, ?, ?, ?, 1)`,
                [guildId, event.id, semifinalists.join(', '), finalists.join(', '), winner || null, third || null]
            );
        });

        res.json({ ok: true, semifinalists, finalists, winner, third });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/events/:slug/doubleelim-results', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const current = await getCurrentDoubleElimResults(pool, guildId, event.id);

        res.json(current);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/events/:slug/doubleelim-results', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug } = req.params;
        const { guildId } = req;

        const upperFinalA = Array.isArray(req.body.upperFinalA) ? req.body.upperFinalA.map(String) : [];
        const lowerFinalA = Array.isArray(req.body.lowerFinalA) ? req.body.lowerFinalA.map(String) : [];
        const upperFinalB = Array.isArray(req.body.upperFinalB) ? req.body.upperFinalB.map(String) : [];
        const lowerFinalB = Array.isArray(req.body.lowerFinalB) ? req.body.lowerFinalB.map(String) : [];

        for (const [label, arr] of [['Upper Final A', upperFinalA], ['Lower Final A', lowerFinalA], ['Upper Final B', upperFinalB], ['Lower Final B', lowerFinalB]]) {
            if (arr.length > 2) {
                return res.status(400).json({ error: `${label}: limit 2 teams` });
            }
        }

        const all = [...upperFinalA, ...lowerFinalA, ...upperFinalB, ...lowerFinalB];

        if (!all.length) {
            return res.status(400).json({ error: 'No teams selected' });
        }

        if (new Set(all).size !== all.length) {
            return res.status(400).json({ error: 'A team cannot appear in more than one slot' });
        }

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const teams = await loadActiveTeams(pool, guildId);
        const invalid = all.filter((t) => !teams.includes(t));

        if (invalid.length) {
            return res.status(400).json({ error: `Unknown or inactive teams: ${invalid.join(', ')}` });
        }

        await runInTransaction(pool, async (conn) => {
            await conn.query(
                'UPDATE doubleelim_results SET active = 0 WHERE guild_id = ? AND event_id = ? AND active = 1',
                [guildId, event.id]
            );

            await conn.query(
                `INSERT INTO doubleelim_results
                    (guild_id, event_id, upper_final_a, lower_final_a, upper_final_b, lower_final_b, active, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
                [guildId, event.id, upperFinalA.join(', ') || null, lowerFinalA.join(', ') || null, upperFinalB.join(', ') || null, lowerFinalB.join(', ') || null]
            );
        });

        res.json({ ok: true, upperFinalA, lowerFinalA, upperFinalB, lowerFinalB });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/events/:slug/playin-results', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const current = await getCurrentPlayinResults(pool, guildId, event.id);

        res.json(current);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/events/:slug/playin-results', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug } = req.params;
        const { guildId } = req;

        const teams = Array.isArray(req.body.teams) ? Array.from(new Set(req.body.teams.map(String))) : [];

        if (teams.length !== 8) {
            return res.status(400).json({ error: `Play-In requires exactly 8 teams (got ${teams.length})` });
        }

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const activeTeams = await loadActiveTeams(pool, guildId);
        const invalid = teams.filter((t) => !activeTeams.includes(t));

        if (invalid.length) {
            return res.status(400).json({ error: `Unknown or inactive teams: ${invalid.join(', ')}` });
        }

        await runInTransaction(pool, async (conn) => {
            await conn.query(
                'UPDATE playin_results SET active = 0 WHERE guild_id = ? AND event_id = ?',
                [guildId, event.id]
            );

            await conn.query(
                `INSERT INTO playin_results (guild_id, event_id, correct_teams, active)
                 VALUES (?, ?, ?, 1)`,
                [guildId, event.id, teams.join(', ')]
            );
        });

        res.json({ ok: true, teams });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/events/:slug/mvp', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const [candidates] = await pool.query(
            `
            SELECT id, nickname, team_name, is_active
            FROM mvp_candidates
            WHERE guild_id = ? AND event_id = ?
            ORDER BY is_active DESC, nickname ASC
            `,
            [guildId, event.id]
        );

        const [[result]] = await pool.query(
            `
            SELECT candidate_id
            FROM mvp_results
            WHERE guild_id = ? AND event_id = ? AND active = 1
            LIMIT 1
            `,
            [guildId, event.id]
        );

        res.json({ candidates, result: result || null });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/events/:slug/mvp/candidates', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug } = req.params;
        const { guildId } = req;
        const { entries } = req.body;

        if (!Array.isArray(entries) || !entries.length) {
            return res.status(400).json({
                error: 'entries must be a non-empty array of { nickname, teamName }'
            });
        }

        const clean = entries
            .map(e => ({
                nickname: String(e.nickname || '').trim(),
                teamName: e.teamName ? String(e.teamName).trim() : null
            }))
            .filter(e => e.nickname);

        if (!clean.length) {
            return res.status(400).json({ error: 'No valid candidates provided' });
        }

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        await runInTransaction(pool, async (conn) => {
            await conn.query(
                'UPDATE mvp_candidates SET is_active = 0 WHERE guild_id = ? AND event_id = ?',
                [guildId, event.id]
            );

            for (const c of clean) {
                await conn.query(
                    `
                    INSERT INTO mvp_candidates (guild_id, event_id, nickname, team_name, is_active)
                    VALUES (?, ?, ?, ?, 1)
                    `,
                    [guildId, event.id, c.nickname, c.teamName]
                );
            }
        });

        res.json({ ok: true, count: clean.length });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/events/:slug/mvp/result', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug } = req.params;
        const { guildId } = req;
        const candidateId = Number(req.body.candidateId);

        if (!Number.isInteger(candidateId) || candidateId <= 0) {
            return res.status(400).json({ error: 'candidateId is required' });
        }

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        await pool.query(
            `
            INSERT INTO mvp_results (guild_id, event_id, candidate_id, active)
            VALUES (?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                candidate_id = VALUES(candidate_id),
                active = 1,
                updated_at = CURRENT_TIMESTAMP
            `,
            [guildId, event.id, candidateId]
        );

        res.json({ ok: true, candidateId });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.get('/api/events/:slug/export/classification', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const buffer = await exportClassification({ guildId, eventId: event.id });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="klasyfikacja-${slug}.xlsx"`);
        res.send(buffer);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Failed to generate classification export'
        });
    }
});

app.get('/api/events/:slug/phases/:phase/clear-preview', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug, phase } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const [[points]] = await pool.query(
            `
            SELECT COUNT(*) AS count
            FROM match_points mp
            JOIN matches m ON m.id = mp.match_id
            WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
            `,
            [phase, guildId, event.id]
        );

        const [[predictions]] = await pool.query(
            `
            SELECT COUNT(*) AS count
            FROM match_predictions pr
            JOIN matches m ON m.id = pr.match_id
            WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
            `,
            [phase, guildId, event.id]
        );

        const [[results]] = await pool.query(
            `
            SELECT COUNT(*) AS count
            FROM match_results mr
            JOIN matches m ON m.id = mr.match_id
            WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
            `,
            [phase, guildId, event.id]
        );

        const [[matches]] = await pool.query(
            `
            SELECT COUNT(*) AS count
            FROM matches
            WHERE phase = ? AND guild_id = ? AND event_id = ?
            `,
            [phase, guildId, event.id]
        );

        res.json({
            matches: matches.count,
            predictions: predictions.count,
            results: results.count,
            points: points.count
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
        });
    }
});

app.post('/api/events/:slug/phases/:phase/clear', requireGuildAdmin(guildIdFromEventSlug), async (req, res) => {
    try {
        const { slug, phase } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
            'SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1',
            [guildId, slug]
        );

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const { r1, r2, r3, r4 } = await runInTransaction(pool, async (conn) => {
            const [r1] = await conn.query(
                `
                DELETE mp
                FROM match_points mp
                JOIN matches m ON m.id = mp.match_id
                WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                `,
                [phase, guildId, event.id]
            );

            const [r2] = await conn.query(
                `
                DELETE pr
                FROM match_predictions pr
                JOIN matches m ON m.id = pr.match_id
                WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                `,
                [phase, guildId, event.id]
            );

            const [r3] = await conn.query(
                `
                DELETE mr
                FROM match_results mr
                JOIN matches m ON m.id = mr.match_id
                WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                `,
                [phase, guildId, event.id]
            );

            const [r4] = await conn.query(
                `
                DELETE FROM matches
                WHERE phase = ? AND guild_id = ? AND event_id = ?
                `,
                [phase, guildId, event.id]
            );

            return { r1, r2, r3, r4 };
        });

        logWarn('matches', 'Cleared matches phase via web panel', {
            guildId,
            eventId: event.id,
            phase,
            deleted_points: r1?.affectedRows ?? 0,
            deleted_predictions: r2?.affectedRows ?? 0,
            deleted_results: r3?.affectedRows ?? 0,
            deleted_matches: r4?.affectedRows ?? 0,
            by: req.session?.user?.id
        });

        io.emit('dashboard:refresh', { slug });

        res.json({
            ok: true,
            deleted: {
                matches: r4?.affectedRows ?? 0,
                predictions: r2?.affectedRows ?? 0,
                results: r3?.affectedRows ?? 0,
                points: r1?.affectedRows ?? 0
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Database error'
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

        if (!fs.existsSync(finalPath)) {
            return res.status(404).json({
                error: 'Archive file missing'
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

const PORT = Number(process.env.PORT || 3301);

httpServer.listen(PORT, () => {
    console.log(`WEB SERWER DZIAŁA NA http://localhost:${PORT}`);
});

startCs2LogReceiver({
    port: Number(process.env.CS2_LOG_PORT || 27500),
    onLine(raw) {
        const parsed = parseCs2LogLine(raw);

        if (!parsed) return;

        console.log('[CS2 PARSED]', parsed);
    }
});