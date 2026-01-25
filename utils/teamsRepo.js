// utils/teamsRepo.js
const { withGuild } = require('./guildContext');
const logger = require('./logger');

async function getActiveTeams(source) {
  try {
    return await withGuild(source, async ({ guildId, pool }) => {
      const [rows] = await pool.query(
        `
        SELECT name, short_name
        FROM teams
        WHERE guild_id = ?
          AND active = 1
        ORDER BY sort_order ASC, name ASC
        `,
        [guildId]
      );

      return rows.map(r => {
        const name = String(r.name || '').trim();
        const short =
          r.short_name && String(r.short_name).trim()
            ? String(r.short_name).trim()
            : name;

        return { name, short };
      });
    });
  } catch (err) {
    logger.error('teamsRepo', 'getActiveTeams failed', {
      message: err.message,
      stack: err.stack,
    });
    return [];
  }
}

module.exports = { getActiveTeams };
