// utils/teamsStore.js
const fs = require('fs');
const path = require('path');
const { withGuild } = require('./guildContext');
const logger = require('./logger');
const teamsState = require('./teamsState');

/* ===============================
   HELPERS
=============================== */

function normName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}

/* ===============================
   READ
=============================== */

async function listTeams(source, { includeInactive = true } = {}) {
  return withGuild(source, async ({ guildId, pool }) => {
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
  });
}

async function getTeamNames(source, opts = {}) {
  const rows = await listTeams(source, opts);
  return rows.map(r => r.name);
}

/* ===============================
   WRITE
=============================== */

async function ensureSortOrder(source) {
  return withGuild(source, async ({ guildId, pool }) => {
    const [rows] = await pool.query(
      `SELECT id FROM teams WHERE guild_id = ? ORDER BY sort_order ASC, name ASC`,
      [guildId]
    );

    let i = 1;
    for (const r of rows) {
      await pool.query(
        `UPDATE teams SET sort_order = ? WHERE guild_id = ? AND id = ?`,
        [i, guildId, r.id]
      );
      i++;
    }
  });
}

async function replaceTeams(source, names) {
  return withGuild(source, async ({ guildId, pool }) => {
    const cleaned = Array.from(new Set(names.map(normName).filter(Boolean)));

    await pool.query(`DELETE FROM teams WHERE guild_id = ?`, [guildId]);

    if (cleaned.length) {
      const values = cleaned.map((name, idx) => [
        guildId,
        name,
        null,
        1,
        idx + 1
      ]);

      await pool.query(
        `INSERT INTO teams (guild_id, name, short_name, active, sort_order)
         VALUES ?`,
        [values]
      );
    }

    teamsState?.invalidateTeams?.(guildId);
  });
}

async function addTeam(source, name, { shortName = null } = {}) {
  return withGuild(source, async ({ guildId, pool }) => {
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
  });
}

async function renameTeam(source, teamId, newName, { shortName = null } = {}) {
  return withGuild(source, async ({ guildId, pool }) => {
    const clean = normName(newName);
    if (!clean) throw new Error('EMPTY_TEAM_NAME');

    await pool.query(
      `
      UPDATE teams
      SET name = ?, short_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE guild_id = ? AND id = ?
      `,
      [clean, shortName, guildId, Number(teamId)]
    );

    teamsState?.invalidateTeams?.(guildId);
  });
}

async function toggleTeamActive(source, teamId) {
  return withGuild(source, async ({ guildId, pool }) => {
    await pool.query(
      `
      UPDATE teams
      SET active = IF(active=1, 0, 1),
          updated_at = CURRENT_TIMESTAMP
      WHERE guild_id = ? AND id = ?
      `,
      [guildId, Number(teamId)]
    );

    teamsState?.invalidateTeams?.(guildId);
  });
}

async function deleteTeams(source, teamIds) {
  return withGuild(source, async ({ guildId, pool }) => {
    const ids = (teamIds || []).map(Number).filter(Boolean);
    if (!ids.length) return;

    await pool.query(
      `DELETE FROM teams WHERE guild_id = ? AND id IN (?)`,
      [guildId, ids]
    );

    await ensureSortOrder(guildId);
    teamsState?.invalidateTeams?.(guildId);
  });
}

async function reorderTeams(source, orderedIds) {
  return withGuild(source, async ({ guildId, pool }) => {
    const ids = (orderedIds || []).map(Number).filter(Boolean);

    let i = 1;
    for (const id of ids) {
      await pool.query(
        `
        UPDATE teams
        SET sort_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = ? AND id = ?
        `,
        [i, guildId, id]
      );
      i++;
    }

    teamsState?.invalidateTeams?.(guildId);
  });
}

/* ===============================
   IMPORT / MIGRATION
=============================== */

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

async function importTeamsFromJsonText(source, jsonText) {
  const names = parseTeamsJsonText(jsonText);
  await replaceTeams(source, names);
  return names.length;
}

async function migrateTeamsJsonToDb(source) {
  const filePath = path.join(__dirname, '..', 'teams.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('TEAMS_JSON_NOT_FOUND');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const names = parseTeamsJsonText(raw);

  await replaceTeams(source, names);

  logger.info('teams', 'Migrated teams.json -> DB', {
    guildId: typeof source === 'string' ? source : source?.guildId,
    count: names.length
  });

  return names.length;
}

// alias dla starego kodu
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
