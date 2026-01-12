// utils/teamsStore.js
const fs = require('fs');
const path = require('path');
const db = require('../db');
const logger = require('./logger');
const teamsState = require('./teamsState');

/**
 * Normalizacja nazwy drużyny
 */
function normName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}

async function listTeams(guildId, { includeInactive = true } = {}) {
  const pool = db.getPoolForGuild(guildId);
  const [rows] = await pool.query(
    `
    SELECT id, name, short_name, active, sort_order, created_at, updated_at
    FROM teams
    WHERE guild_id = ?
      AND (? = 1 OR active = 1)
    ORDER BY sort_order ASC, name ASC
    `,
    [guildId, includeInactive ? 1 : 0]
  );
  return rows;
}

async function getTeamNames(guildId, { includeInactive = false } = {}) {
  const rows = await listTeams(guildId, { includeInactive });
  return rows.map(r => r.name);
}

async function ensureSortOrder(guildId) {
  const pool = db.getPoolForGuild(guildId);
  const [rows] = await pool.query(
    `SELECT id FROM teams WHERE guild_id = ? ORDER BY sort_order ASC, name ASC`,
    [guildId]
  );

  let i = 1;
  for (const r of rows) {
    await pool.query(`UPDATE teams SET sort_order = ? WHERE id = ?`, [i, r.id]);
    i++;
  }
}

async function replaceTeams(guildId, names) {
  const pool = db.getPoolForGuild(guildId);

  const cleaned = Array.from(new Set(names.map(normName).filter(Boolean)));

  await pool.query('DELETE FROM teams WHERE guild_id = ?', [guildId]);

  if (cleaned.length) {
    const values = cleaned.map((name, idx) => [
      guildId,
      name,
      null, // short_name
      1,    // active
      idx + 1
    ]);

    await pool.query(
      `INSERT INTO teams (guild_id, name, short_name, active, sort_order)
       VALUES ?`,
      [values]
    );
  }

  teamsState?.invalidateTeams?.(guildId);
}

async function addTeam(guildId, name, { shortName = null } = {}) {
  const pool = db.getPoolForGuild(guildId);

  const clean = normName(name);
  if (!clean) throw new Error('EMPTY_TEAM_NAME');

  const [[maxRow]] = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS m FROM teams WHERE guild_id = ?`,
    [guildId]
  );
  const nextOrder = (maxRow?.m ?? 0) + 1;

  await pool.query(
    `
    INSERT INTO teams (guild_id, name, short_name, active, sort_order)
    VALUES (?, ?, ?, 1, ?)
    `,
    [guildId, clean, shortName, nextOrder]
  );

  teamsState?.invalidateTeams?.(guildId);
}

/**
 * ✅ Rename z obsługą short_name
 */
async function renameTeam(guildId, teamId, newName, opts = {}) {
  const pool = db.getPoolForGuild(guildId);
  const clean = normName(newName);
  const shortName = opts?.shortName ?? null;

  if (!clean) throw new Error('EMPTY_TEAM_NAME');

  await pool.query(
    `UPDATE teams
     SET name = ?, short_name = ?, updated_at = CURRENT_TIMESTAMP
     WHERE guild_id = ? AND id = ?`,
    [clean, shortName, guildId, Number(teamId)]
  );

  teamsState?.invalidateTeams?.(guildId);
}

/**
 * ✅ Toggle active
 */
async function toggleTeamActive(guildId, teamId) {
  const pool = db.getPoolForGuild(guildId);
  await pool.query(
    `UPDATE teams
     SET active = IF(active=1, 0, 1),
         updated_at = CURRENT_TIMESTAMP
     WHERE guild_id = ? AND id = ?`,
    [guildId, Number(teamId)]
  );

  teamsState?.invalidateTeams?.(guildId);
}

async function deleteTeams(guildId, teamIds) {
  const pool = db.getPoolForGuild(guildId);
  const ids = (teamIds || []).map(x => Number(x)).filter(Boolean);
  if (!ids.length) return;

  await pool.query(
    `DELETE FROM teams WHERE guild_id = ? AND id IN (?)`,
    [guildId, ids]
  );

  await ensureSortOrder(guildId);
  teamsState?.invalidateTeams?.(guildId);
}

async function reorderTeams(guildId, orderedIds) {
  const pool = db.getPoolForGuild(guildId);
  const ids = (orderedIds || []).map(x => Number(x)).filter(Boolean);

  let i = 1;
  for (const id of ids) {
    await pool.query(
      `UPDATE teams SET sort_order = ?, updated_at = CURRENT_TIMESTAMP
       WHERE guild_id = ? AND id = ?`,
      [i, guildId, id]
    );
    i++;
  }

  teamsState?.invalidateTeams?.(guildId);
}

function parseTeamsJsonText(text) {
  let arr;
  try {
    arr = JSON.parse(text);
  } catch {
    throw new Error('INVALID_JSON');
  }
  if (!Array.isArray(arr)) throw new Error('INVALID_JSON');
  return arr.map(normName).filter(Boolean);
}

async function importTeamsFromJsonText(guildId, jsonText) {
  const names = parseTeamsJsonText(jsonText);
  await replaceTeams(guildId, names);
  return names.length;
}

/**
 * Jednorazowa migracja z teams.json -> DB
 * Zakłada teams.json w głównym katalogu projektu.
 */
async function migrateTeamsJsonToDb(guildId) {
  const filePath = path.join(__dirname, '..', 'teams.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('TEAMS_JSON_NOT_FOUND');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const names = parseTeamsJsonText(raw);

  await replaceTeams(guildId, names);

  logger.info('teams', 'Migrated teams.json -> DB', {
    guildId,
    count: names.length
  });

  return names.length;
}

// alias (dla starego kodu)
const toggleTeam = toggleTeamActive;

module.exports = {
  listTeams,
  getTeamNames,
  addTeam,
  renameTeam,
  toggleTeamActive,
  toggleTeam,
  deleteTeams,
  reorderTeams,
  replaceTeams,
  importTeamsFromJsonText,
  migrateTeamsJsonToDb
};
