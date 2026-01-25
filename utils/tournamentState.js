// ❌ USUŃ withGuild stąd
// const { withGuild } = require('./guildContext');

const db = require('../db');
const logger = require('./logger');
const { ensureTournamentState } = require('./ensureTournamentTables');

async function getTournamentState(guildId, pool) {
  if (!guildId || !pool) {
    return {
      ok: false,
      phase: 'UNKNOWN',
      isOpen: false,
      error: 'Missing guild context',
    };
  }

  try {
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

async function isPredictionsOpen(guildId, pool) {
  const state = await getTournamentState(guildId, pool);
  return state.ok && state.isOpen;
}

module.exports = {
  getTournamentState,
  isPredictionsOpen,
};
