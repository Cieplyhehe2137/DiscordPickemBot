const db = require("../db.js");
const { withGuild } = require("./guildContext.js");
const { ensureTournamentState } = require("./ensureTournamentTables.js");

async function getTournamentState(guildId) {
  return withGuild(guildId, async () => {
    const pool = db.getPoolForGuild(guildId);

    try {
      await ensureTournamentState(pool);
      const [[row]] = await pool.query(
        "SELECT phase, is_open FROM tournament_state WHERE id = 1"
      );

      return {
        exists: true,
        phase: row?.phase ?? "UNKNOWN",
        isOpen: !!row?.is_open,
      };
    } catch (err) {
      return {
        exists: false,
        phase: "UNKNOWN",
        isOpen: false,
        error: err?.code || err?.message,
      };
    }
  });
}

async function isPredictionsOpen(guildId) {
  const s = await getTournamentState(guildId);
  return !!s.isOpen;
}

module.exports = {
  getTournamentState,
  isPredictionsOpen,
};
