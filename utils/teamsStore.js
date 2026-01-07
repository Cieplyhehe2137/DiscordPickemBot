const fs = require('fs');
const path = require('path');
const pool = require('../db');
const logger = require('./logger');
const { default: teamsState } = require('./teamsState');

const ROOT_TEAMS_PATH = path.join(__dirname, '..', 'teams.json');
const DATA_TEAMS_PATH = path.join(__dirname, '..', 'data', 'teams.json');

async function ensureTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(32) NOT NULL,
      name VARCHAR(100) NOT NULL,
      short_name VARCHAR(30) NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_guild_name (guild_id, name),
      KEY idx_guild_active (guild_id, active),
      KEY idx_guild_sort (guild_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

function readTeamsJsonFallback() {
    const tryPaths = [ROOT_TEAMS_PATH, DATA_TEAMS_PATH];
    for (const p of tryPaths) {
        try {
            if (!fs.existsSync(p)) continue;
            const raw = fs.readFileSync(p, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed
                    .map(t => (typeof t === 'string' ? t : (t?.name || t?.label || t?.value)))
                    .map(s => String(s || '').trim())
                    .filter(Boolean);
            }
        } catch (e) {
            // ignore
        }
    }
    return [];
}

function writeTeamsJsonFiles(teamNames) {
    const payload = JSON.stringify(teamNames, null, 2);
    try { fs.writeFileSync(ROOT_TEAMS_PATH, payload, 'utf8'); } catch (_) { }
    try {
        fs.mkdirSync(path.dirname(DATA_TEAMS_PATH), { recursive: true });
        fs.writeFileSync(DATA_TEAMS_PATH, payload, 'utf8');
    } catch (_) { }
}

async function listTeams(guildId, { includeInactive = true } = {}) {
    await ensureTable();
    const [rows] = await pool.query(
        `SELECT id, name, short_name, active, sort_order
         FROM teams
         WHERE guild_id = ?
            ${includeInactive ? '' : 'AND active = 1'}
        ORDER BY sort_order ASC, name ASC`,
        [String(guildId)]
    );
    return rows;
}

async function getTeamNames(guildId, { includeInactive = false } = {}) {
    try {
        const rows = await listTeams(guildId, { includeInactive });
        const names = rows
            .filter(r => includeInactive ? true : r.active === 1)
            .map(r => String(r.name).trim())
            .filter(Boolean);

        if (!names.length) {
            const fallback = readTeamsJsonFallback();
            if (fallback.length) {
                await seedFromNames(guildId, fallback, { replace: true, syncFiles: true });
                return fallback;
            }
        }

        return names;
    } catch (e) {
        logger.warn('teams', 'DB teams read failed, using teams.json fallback', { message: e.message });
        return readTeamsJsonFallback();
    }
}

async function syncFilesFromDb(guildId) {
    const names = await getTeamNames(guildId, { includeInactive: false });
    writeTeamsJsonFiles(names);
    return names;
}

async function addTeam(guildId, name, shortName = null) {
    await ensureTable();
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('EMPTY_NAME');

    const [[m]] = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0) AS mx FROM teams WHERE guild_id = ?`,
        [String(guildId)]
    );
    const next = Number(m?.mx || 0) + 1;

    await pool.query(
        `INSERT INTO teams (guild_id, name, short_name, sort_order, active)
        VALUES (?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
           short_name = values(short_name),
           active = 1`,
        [String(guildId), cleanName, shortName ? String(shortName).trim() : null, next]
    );

    await syncFilesFromDb(guildId);

    teamsState.invalidateTeams(guildId)
}

async function deleteTeam(guildId, teamId) {
    await ensureTable();
    await pool.query(
        `DELETE FROM teams WHERE guild_id = ? AND id = ?`,
        [String(guildId), Number(teamId)]
    );
    await syncFilesFromDb(guildId);
}

async function deleteTeams(guildId, teamIds) {
  await ensureTable();

  const ids = [...new Set((Array.isArray(teamIds) ? teamIds : [])
    .map(n => Number(n))
    .filter(n => Number.isFinite(n) && n > 0))];

  if (!ids.length) return 0;

  const placeholders = ids.map(() => '?').join(',');
  await pool.query(
    `DELETE FROM teams WHERE guild_id = ? AND id IN (${placeholders})`,
    [String(guildId), ...ids]
  );

  await syncFilesFromDb(guildId);
  return ids.length;
}


async function seedFromNames(guildId, names, { replace = false, syncFiles = true } = {}) {
    await ensureTable();

    const clean = (Array.isArray(names) ? names : [])
        .map(s => String(s || '').trim())
        .filter(Boolean);

    const seen = new Set();
    const unique = [];
    for (const n of clean) {
        const k = n.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        unique.push(n);
    }

    if (replace) {
        await pool.query(`DELETE FROM teams WHERE guild_id = ?`, [String(guildId)]);
    }

    const values = unique.map((n, i) => [String(guildId), n, null, 1, i]);
    if (values.length) {
        await pool.query(
            `INSERT INTO teams (guild_id, name, short_name, active, sort_order)
            VALUES ?
            ON DUPLICATE KEY UPDATE
               active = VALUES(active)`,
            [values]
        );
    }

    if (syncFiles) await syncFilesFromDb(guildId);
    return unique;
}

async function importFromJsonText(guildId, jsonText, { replace = true } = {}) {
    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        throw new Error('BAD_JSON');
    }

    if (!Array.isArray(parsed)) throw new Error('BAD_FORMAT');

    const names = parsed
        .map(t => (typeof t === 'string' ? t : (t?.name || t?.label || t?.value)))
        .map(s => String(s || '').trim())
        .filter(Boolean);

    return seedFromNames(guildId, names, { replace, syncFiles: true });
}


async function renameTeam(guildId, teamId, newName, newShortName = null) {
    await ensureTable();

    const cleanName = String(newName || '').trim();
    if (!cleanName) throw new Error('EMPTY_NAME');

    const cleanShort = (newShortName === null || newShortName === undefined || String(newShortName).trim() === '')
        ? null
        : String(newShortName).trim();

    const [res] = await pool.query(
        `UPDATE teams
     SET name = ?, short_name = ?
     WHERE guild_id = ? AND id = ?`,
        [cleanName, cleanShort, String(guildId), Number(teamId)]
    );

    if (!res.affectedRows) throw new Error('NOT_FOUND');

    await syncFilesFromDb(guildId);
    return true;
}

async function toggleTeam(guildId, teamId, active) {
    await ensureTable();

    // jeśli active nie podane — przełącz
    let nextActive;
    if (active === undefined || active === null) {
        const [[row]] = await pool.query(
            `SELECT active FROM teams WHERE guild_id = ? AND id = ?`,
            [String(guildId), Number(teamId)]
        );
        if (!row) throw new Error('NOT_FOUND');
        nextActive = row.active ? 0 : 1;
    } else {
        nextActive = active ? 1 : 0;
    }

    const [res] = await pool.query(
        `UPDATE teams SET active = ? WHERE guild_id = ? AND id = ?`,
        [nextActive, String(guildId), Number(teamId)]
    );

    if (!res.affectedRows) throw new Error('NOT_FOUND');

    await syncFilesFromDb(guildId);
    return nextActive === 1;
}


module.exports = {
    ensureTable,
    listTeams,
    getTeamNames,
    addTeam,
    renameTeam,
    toggleTeam,
    deleteTeam,
    deleteTeams,
    seedFromNames,
    importFromJsonText,
    syncFilesFromDb,
    readTeamsJsonFallback,
    writeTeamsJsonFiles,
    ROOT_TEAMS_PATH,
    DATA_TEAMS_PATH
};