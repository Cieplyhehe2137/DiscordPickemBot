# Pick'Em Bot

Discord Pick'Em platform for CS2 tournaments: players predict matches and
tournament phases from Discord or from the website, results are scored
automatically, and a public leaderboard tracks the standings.

Runs in production for real community events — IEM Kraków 2026, IEM Cologne
2026, StarLadder Budapest Major 2025 — across multiple Discord servers from one
deployment.

---

## How it is put together

Two processes, one database.

| Process | Runs | Purpose |
| --- | --- | --- |
| `pickembot` | `index.js` | Discord bot: slash commands, prediction panels, deadline watchers |
| `pickembot-server` | `server/index.js` | HTTP API, Discord OAuth login, and the website |

They share **only MySQL**. The API has no Discord client and cannot post
messages; the bot does not serve HTTP. Anything that has to cross between them
goes through the database.

The website (`web/`) is a separate React + Vite app. In the default deployment
`pickembot-server` serves its build output from `web/dist` (`express.static`),
so the browser talks to one origin and the session cookie is same-site. Putting
the front end on its own host is supported but needs three things at once —
see **Split hosting** below.

### Two module systems

The bot root is CommonJS (`require`), `server/` is ESM (`import`). Shared code
in `utils/` and `services/` is CommonJS so both sides can use it; the server
reaches it through a `createRequire` bridge at the top of `server/app.js`.

When adding shared code, write it as CommonJS. ESM in `server/lib/` is for
things only the server uses.

### Route modules take their dependencies as arguments

`server/app.js` builds the app and hands each route module what it needs:

```js
registerHealthRoutes(app, { pool });
```

Route modules never import the pool or the Discord client themselves. This
keeps them testable without a database, and it is why `npm run deps` exists —
see below.

---

## Running it locally

Requires Node 24 (CI runs 24; `engines` in `package.json` still says 18 and
should be corrected) and access to a MySQL database.

```bash
npm install
cd server && npm install && cd ..
cd web && npm install && cd ..
```

Three processes, three terminals:

```bash
npm start
```

```bash
cd server && node index.js
```

```bash
cd web && npm run dev
```

The Vite dev server proxies `/api` to the API on port 3301, so the front end
runs against a relative path exactly as it does in production.

### Configuration

Secrets live in `.env` files, none of which are in git.

**`.env`** — the bot:

| | |
| --- | --- |
| `DISCORD_TOKEN` | bot token |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | database |
| `GUILD_CONFIG_DIR` | directory of per-guild `*.env` files (default `config`) |
| `LOG_CHANNEL_ID`, `ARCHIVE_CHANNEL_ID`, `EXPORT_PANEL_CHANNEL_ID` | channels the bot writes to |
| `MATCH_LOCK_BEFORE_SEC`, `MATCH_LOCK_CHECK_MS` | when matches lock before start, and how often that is checked |

**`server/.env`** — the API:

| | |
| --- | --- |
| `PORT` | default 3301 |
| `SESSION_SECRET` | signs session cookies — set it, there is an insecure fallback |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | OAuth login |
| `WEB_ORIGIN` | comma-separated origins allowed in CORS |
| `WEB_ORIGIN_SUFFIX` | wildcard suffix, for per-branch preview URLs |
| `CROSS_ORIGIN_WEB` | switches the session cookie to `SameSite=None; Secure` |
| `VISIT_SALT` | salt for the visit counter — see **Visit counter** |
| `BACKUP_RETENTION` | how many database backups to keep |
| `CS2_LOG_PORT` | UDP port the CS2 log receiver listens on |

**`config/*.env`** — one file per Discord server. `guildRegistry` loads all of
them at startup and **caches them**, so a change here needs a process restart,
not just a reconnect.

---

## Checks

Run before pushing. CI runs all of them.

```bash
npm test
```

163 tests, no database and no network — everything runs against stub pools.
Fast enough to run constantly.

```bash
cd server && npm run lint
```

ESLint with two rules only: `no-undef` and `no-unused-vars`. No style rules.
It exists to catch a name that does not exist, which is what breaks a handler
at request time rather than at startup.

```bash
cd server && npm run routes
```

Builds the app without listening and compares the registered routes against
`server/routes.snapshot.json`, in order. Route order is behaviour — Express
takes the first match — so the snapshot is order-sensitive. When a route
change is deliberate: `npm run routes:save`.

```bash
cd server && npm run deps
```

Compares what `app.js` passes to each route module against what that module
destructures. A mismatch here is legal JavaScript — the missing key is simply
`undefined` — so neither `node --check` nor `no-undef` nor the route check sees
it, and the route registers fine and then throws 500 on the first request. Two
endpoints ran broken in production this way before this check existed.

```bash
cd web && npm run lint && npm run build
```

---

## Deploying

**Merging a pull request changes nothing on the server.** The host has its own
checkout; the code gets there by `git pull`, run on the host, in the directory
the app actually runs from. Nothing else pulls it in - not the build, not a
restart, not PM2, not Plesk. Both of them will happily restart the old code
and report success.

```bash
git pull
```

Everything below assumes that ran first. Skipping it is the single cheapest
way to lose an afternoon: the fix is merged, the build is green, the restart
says OK, and the site keeps behaving exactly as before.

**Then find out which process runs the API before restarting anything.** There
are two entry points into the same `server/app.js`, and only one of them is
PM2's:

| Entry point | Started by | Restarted by |
| --- | --- | --- |
| `server/index.js` | PM2, as `pickembot-server` | `pm2 restart pickembot-server` |
| `web-server.js` | Plesk's Node.js extension | **Restart App** in Plesk, or `touch tmp/restart.txt` |

`ecosystem.config.js` lists only the PM2 pair, so nothing in it hints that the
second one exists. Restarting PM2 when the site is served by Plesk succeeds,
reports success, and changes nothing — the browser keeps getting the old code
from a process PM2 never touched. This has already cost one debugging session:
an API fix was merged, built and "restarted", and the site kept serving the
previous behaviour.

A quick way to tell which code is live: pick a field the fix added and request
the endpoint directly in a browser. A field that is simply absent is proof the
old code is answering — more reliable than reading values, which can look
plausible either way. Add a dummy query parameter (`?x=1`) so a cache in front
of the host cannot answer for it.

When that field is missing, check in this order, in the app's directory:
`git log --oneline -3` (did the commit arrive at all?), then whether the
restarted process is the one serving the site. The first question is the one
that is usually wrong, and it is the cheaper of the two to answer.

```bash
git pull
cd web && npm ci && npm run build
pm2 restart pickembot pickembot-server   # only if PM2 serves the API
```

A front-end-only change needs the build but not the restart: the API serves
`web/dist` from disk. A change to the bot or the API needs the restart — of
whichever process is actually serving it.

`ecosystem.config.js` sets `kill_timeout: 10000` on both processes. PM2's
default of 1600 ms is not enough to close the MySQL pool and disconnect from
Discord, so a process would take SIGKILL halfway through shutting down.

### Split hosting

Serving the front end from its own host needs all three of these, or the
browser silently drops the session cookie:

1. `WEB_ORIGIN` on the API listing that origin,
2. `CROSS_ORIGIN_WEB` set, so the cookie goes out as `SameSite=None; Secure`,
3. HTTPS on the API.

The front end then needs `VITE_API_URL` at build time.

---

## Database

Schema changes go in `migrations/` as `NNNN_short_description.sql`, are applied
**by hand after a full backup**, and `schema.sql` is refreshed afterwards.
There is no automatic runner — the folder is a convention so that changes leave
a trace in git instead of existing only in the history of `ALTER TABLE`
statements on the server. See `migrations/README.md`.

`schema.sql` says what the schema is. The migrations say why it is that way,
which is the part a snapshot cannot carry.

Two things worth knowing before writing queries:

- **Collation is not uniform.** `user_id` is `utf8mb4_0900_ai_ci` in
  `leaderboard` and `utf8mb4_unicode_ci` in the phase tables. A `UNION` across
  both throws `ER_CANT_AGGREGATE_2COLLATIONS`, so every branch has to cast —
  see `services/rebuildEventLeaderboard.js`.
- **`leaderboard` is the source of truth for standings**, not a sum over the
  component tables. Ending a tournament with cleanup deletes `*_predictions`,
  `*_results`, `*_scores`, `match_points` and `matches`, and leaves
  `leaderboard` behind. Anything computing standings live shows an empty table
  for a finished event.

---

## Scoring

Point values live in `rules/scoring.js` and nowhere else. Match scoring is in
`utils/matchScoring.js`; phases are scored in
`handlers/matches/calculateScores.js`.

Two paths write points, and they are not interchangeable:

- `services/recalculateMatchPoints.js` runs after a single entered result and
  touches one match,
- `calculateScores` is the full pass over an event and rebuilds the
  leaderboard at the end.

Both end in `services/rebuildEventLeaderboard.js`, which is the only place the
`leaderboard` table is written.

Recalculating an archived event is refused on purpose: map scoring rules
changed after IEM Cologne 2026, so a rerun would rewrite a closed ranking under
rules that did not apply when it was played.

---

## Front end

`web/` is React + Vite. The styling is a design system, not per-screen CSS:

- `web/src/styles/design-system.css` — tokens. Colours, type scale, spacing,
  radii, shadows. Views use these and never raw values.
- `web/src/styles/components.css` — components. `ui-card`, `ui-badge`,
  `ui-stat`, `ui-choice`, `ui-datatable` and so on.
- `web/src/index.css` — what is left: header, footer, page shell.

Dark theme only. Every screen is built mobile-first — the leaderboard and the
admin classification table become cards on a narrow screen rather than a table
scrolled sideways.

When adding a screen, reach for an existing component first. If a new one is
genuinely needed it belongs in `components.css` with the others, not in a
page-specific rule.

One trap worth knowing: class names must appear **literally** in the source.
Building them by concatenation (`` `ui-row-item--${rank}` ``) means the dead-CSS
sweep cannot see them and will delete the rules. Use a lookup table — there are
several in the codebase for exactly this reason.

---

## Visit counter

The home page shows a visit count. No IP address is stored: the table holds a
hash of IP plus user agent, salted with a value that rotates daily and lives in
`VISIT_SALT` rather than in the database.

Two separate properties. Keeping the salt out of the database means read access
to MySQL is not enough to grind the IPv4 space against a hash. Rotating it
daily means the same person's hashes from two days cannot be linked, so the
table cannot reconstruct anyone's visiting history.

That second property has a consequence the label has to be honest about: the
total is a count of **visits**, not of distinct people. Someone visiting on two
days is two rows.

If `VISIT_SALT` is unset the salt is randomised at startup, which works but
makes every restart re-count that day's earlier visitors.

---

## Tech

Node.js, discord.js v14, Express 5, MySQL 8, React 19, Vite, PM2,
AsyncLocalStorage for per-guild context.

---

## License

Private and proprietary. All rights reserved.
