const db = require("../db.js");
const { withGuild } = require("./guildContext.js");
const { ensureTournamentAuditLog } = require("./ensureTournamentTables.js");

async function logTournamentAction({
  guildId,
  actorId,
  action,
  oldValue = null,
  newValue = null,
}) {
  if (!guildId || !actorId || !action) return;

  return withGuild(guildId, async () => {
    const pool = db.getPoolForGuild(guildId);

    await ensureTournamentAuditLog(pool);

    await pool.query(
      `INSERT INTO tournament_audit_log
       (guild_id, actor_discord_id, action, old_value, new_value)
       VALUES (?, ?, ?, ?, ?)`,
      [guildId, actorId, action, oldValue, newValue]
    );
  });
}

module.exports = { logTournamentAction };
