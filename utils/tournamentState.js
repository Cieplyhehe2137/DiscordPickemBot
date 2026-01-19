const db = require("../db.js");
const { ensureTournamentState } = require("./ensureTournamentTables.js");

// Tabela tournament_state jest w bazie KAŻDEGO guilda (multi-guild)
async function getTournamentState(guildId) {
  if (!guildId) {
    return {
      exists: false,
      phase: "UNKNOWN",
      isOpen: false,
      error: "Missing guildId"
    };
  }

  const pool = db.getPoolForGuild(guildId);

  try {
    await ensureTournamentState(pool);

    const [[row]] = await pool.query(
      "SELECT phase, is_open FROM tournament_state WHERE id = 1"
    );

    return {
      exists: true,
      phase: row?.phase ?? "UNKNOWN",
      isOpen: !!row?.is_open
    };
  } catch (err) {
    return {
      exists: false,
      phase: "UNKNOWN",
      isOpen: false,
      error: err?.message || err?.code
    };
  }
}

async function isPredictionsOpen(guildId) {
  const s = await getTournamentState(guildId);
  return !!s.isOpen;
}

module.exports = {
  getTournamentState,
  isPredictionsOpen,
};
