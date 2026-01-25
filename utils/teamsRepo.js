// utils/teamsRepo.js
const db = require('../db');
// const { safeQuery } = require('./safeQuery');
const logger = require('./logger');

async function getActiveTeams(guildId) {
  if (!guildId) {
    logger.error('teamsRepo', 'getActiveTeams called without guildId');
    return [];
  }

  const pool = db.getPoolForGuild(guildId);

  const [rows] = await pool.query(
    pool,
    `
    SELECT name, short_name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY sort_order ASC, name ASC
    `,
    [guildId],
    {
      guildId,
      scope: 'teamsRepo',
      label: 'getActiveTeams',
    }
  );

  return rows.map(r => {
    const name = String(r.name || '').trim();
    const short =
      r.short_name && String(r.short_name).trim()
        ? String(r.short_name).trim()
        : name;

    return {
      name,
      short,
    };
  });
}

module.exports = { getActiveTeams };
