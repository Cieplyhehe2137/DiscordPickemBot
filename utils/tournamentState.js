const db = require("../db.js");
const { withGuild } = require("./guildContext.js");
const { ensureTournamentState } = require("./ensureTournamentTables.js");

async function isPredictionsOpen(guildId) {
  return withGuild(guildId, async () => {
    const pool = db.getPoolForGuild(guildId);

    try {
      await ensureTournamentState(pool);

      const [[row]] = await pool.query(
        "SELECT is_open FROM tournament_state WHERE id = 1"
      );

      return !!row?.is_open;
    } catch (err) {
      // brak tabeli / błąd = traktujemy jak zamknięte
      return false;
    }
  });
}

module.exports = {
  isPredictionsOpen,
};
