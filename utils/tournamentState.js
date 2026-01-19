const db = require("../db.js");
const { ensureTournamentState } = require("./ensureTournamentTables.js");

// GLOBALNY stan turnieju (jedna tabela, brak guild_id)
async function getTournamentState() {
  const pool = db.getGlobalPool ? db.getGlobalPool() : db.getPool();

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

async function isPredictionsOpen() {
  const s = await getTournamentState();
  return !!s.isOpen;
}

module.exports = {
  getTournamentState,
  isPredictionsOpen,
};
