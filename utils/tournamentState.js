// utils/tournamentState.js
const logger = require('./logger');
const { withGuild } = require('./guildContext');
const { ensureTournamentState } = require('./ensureTournamentTables');

/**
 * tournament_state – per guild
 */
async function getTournamentState(source) {
  try {
    return await withGuild(source, async ({ guildId, pool }) => {
      // self-heal (twardo w kontekście guild)
      await ensureTournamentState(pool);

      const [[row]] = await pool.query(
        `SELECT phase, is_open
         FROM tournament_state
         WHERE id = 1`
      );

      return {
        ok: true,
        phase: row?.phase ?? 'UNKNOWN',
        isOpen: !!row?.is_open,
      };
    });
  } catch (err) {
    logger.error('tournament', 'getTournamentState failed', {
      guildId: typeof source === 'string' ? source : source?.guildId,
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

/**
 * Sugar helper
 */
async function isPredictionsOpen(source) {
  const state = await getTournamentState(source);
  return state.ok && state.isOpen;
}

module.exports = {
  getTournamentState,
  isPredictionsOpen,
};
