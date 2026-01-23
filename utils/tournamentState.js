const db = require('../db');
const logger = require('./logger');
const { ensureTournamentState } = require('./ensureTournamentTables');

// tournament_state istnieje per-guild (multi-guild DB)
async function getTournamentState(guildId) {
  if (!guildId) {
    return {
      ok: false,
      phase: 'UNKNOWN',
      isOpen: false,
      error: 'Missing guildId',
    };
  }

  const pool = db.getPoolForGuild(guildId);

  try {
    // self-heal
    await ensureTournamentState(pool);

    const [[row]] = await pool.query(
      'SELECT phase, is_open FROM tournament_state WHERE id = 1'
    );

    return {
      ok: true,
      phase: row?.phase ?? 'UNKNOWN',
      isOpen: !!row?.is_open,
    };
  } catch (err) {
    logger.error('tournament', 'getTournamentState failed', {
      guildId,
      message: err.message,
      stack: err.stack,
    });

    return {
      ok: false,
      phase: 'UNKNOWN',
      isOpen: false,
      error: err.message,
    };
  }
}

async function isPredictionsOpen(guildId) {
  const state = await getTournamentState(guildId);
  return state.ok && state.isOpen;
}

module.exports = {
  getTournamentState,
  isPredictionsOpen,
};
