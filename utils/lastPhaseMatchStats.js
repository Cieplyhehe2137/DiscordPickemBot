const {
  maybePostMatchStats
} = require('../handlers/maybePostMatchStats');

const { logError } = require('./logger');

async function isPhaseScheduleComplete({
  pool,
  guildId,
  eventId,
  phase
}) {
  const [rows] = await pool.query(
    `
    SELECT schedule_complete
    FROM phase_schedule_state
    WHERE guild_id = ?
      AND (event_id = ? OR event_id IS NULL)
      AND phase = ?
    ORDER BY event_id IS NULL ASC
    LIMIT 1
    `,
    [guildId, eventId || null, phase]
  );

  return rows?.[0]?.schedule_complete === 1;
}

async function isLastMatchOfPhase({
  pool,
  guildId,
  matchId
}) {
  const [[match]] = await pool.query(
    `
    SELECT
      id,
      guild_id,
      event_id,
      phase,
      start_time_utc
    FROM matches
    WHERE id = ?
      AND guild_id = ?
    LIMIT 1
    `,
    [matchId, guildId]
  );

  if (!match?.phase) {
    return false;
  }

  const complete =
    await isPhaseScheduleComplete({
      pool,
      guildId,
      eventId: match.event_id,
      phase: match.phase
    });

  if (!complete) {
    return false;
  }

  const [laterMatches] = await pool.query(
    `
    SELECT id
    FROM matches
    WHERE guild_id = ?
      AND phase = ?
      AND id <> ?
      AND start_time_utc IS NOT NULL
      AND start_time_utc > ?
    LIMIT 1
    `,
    [
      guildId,
      match.phase,
      match.id,
      match.start_time_utc
    ]
  );

  return laterMatches.length === 0;
}

async function maybePostLastPhaseMatchStats({
  client,
  pool,
  guildId,
  channelId,
  matchId
}) {
  try {
    const last = await isLastMatchOfPhase({
      pool,
      guildId,
      matchId
    });

    if (!last) {
      return {
        posted: false,
        reason:
          'not_last_match_or_schedule_not_complete'
      };
    }

    return maybePostMatchStats({
      client,
      pool,
      guildId,
      channelId,
      matchId,
      statsType: 'last_phase_match_start'
    });
  } catch (err) {
    logError(
      'stats',
      'maybePostLastPhaseMatchStats failed',
      {
        guildId,
        matchId,
        message: err.message,
        stack: err.stack
      }
    );

    return {
      posted: false,
      reason: 'error'
    };
  }
}

module.exports = {
  isLastMatchOfPhase,
  maybePostLastPhaseMatchStats
};