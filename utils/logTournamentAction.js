const db = require('../db');
const logger = require('./logger');
const { ensureTournamentAuditLog } = require('./ensureTournamentTables');

function normalize(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

async function logTournamentAction({
  guildId,
  actorId,
  action,
  oldValue = null,
  newValue = null,
}) {
  if (!guildId || !actorId || !action) return;

  try {
    const pool = db.getPoolForGuild(guildId);

    // self-heal tabeli
    await ensureTournamentAuditLog(pool);

    await pool.query(
      `
      INSERT INTO tournament_audit_log
        (guild_id, actor_discord_id, action, old_value, new_value)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        guildId,
        actorId,
        action,
        normalize(oldValue),
        normalize(newValue),
      ]
    );
  } catch (err) {
    // ❗ audit log NIGDY nie może wywalić głównej operacji
    logger.error('audit', 'logTournamentAction failed', {
      guildId,
      actorId,
      action,
      message: err.message,
      stack: err.stack,
    });
  }
}

module.exports = { logTournamentAction };
