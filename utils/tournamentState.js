const db = require('../db');
const logger = require('./logger');
const { ensureTournamentState } = require('./ensureTournamentTables');

// tournament_state per-guild (multi-guild DB)
async function getTournamentState(guildId) {
  if (!guildId) {
    return {
      exists: false,
      phase: 'UNKNOWN',
      is_open: false,
      error: 'Missing guildId',
    };
  }

  const pool = db.getPoolForGuild(guildId);

  try {
    // self-heal + migracja
    await ensureTournamentState(pool, guildId);

    const [[row]] = await pool.query(
      'SELECT phase, is_open FROM tournament_state WHERE guild_id = ? AND id = 1',
      [String(guildId)]
    );

    return {
      exists: true,
      phase: row?.phase ?? 'UNKNOWN',
      is_open: !!row?.is_open,
    };
  } catch (err) {
    logger.error('tournament', 'getTournamentState failed', {
      guildId,
      message: err.message,
      stack: err.stack,
    });

    return {
      exists: false,
      phase: 'UNKNOWN',
      is_open: false,
      error: err.message,
    };
  }
}

async function isPredictionsOpen(guildId) {
  const state = await getTournamentState(guildId);
  return state.exists && state.is_open;
}

module.exports = {
  getTournamentState,
  isPredictionsOpen,
};
