const db = require("../db");

async function withGuild(source, fn) {
  let guildId = null;

  // ======================================================
  // GUILD ID
  // ======================================================

  if (typeof source === "string") {
    guildId = source;
  } else if (source?.guildId) {
    guildId = source.guildId;
  }

  if (!guildId) {
    throw new Error(
      "[withGuild] Brak guildId " + "(DM / nieprawidłowe źródło)",
    );
  }

  guildId = String(guildId);

  // ======================================================
  // POOL
  // ======================================================

  const pool = db.getPoolForGuild(guildId);

  if (!pool) {
    throw new Error(`[withGuild] Brak poola DB dla guildId=${guildId}`);
  }

  // ======================================================
  // WALIDACJA POOLA
  //
  // Bez SELECT 1.
  // ======================================================

  if (typeof pool.query !== "function") {
    throw new Error(`[withGuild] Nieprawidłowy pool DB dla guildId=${guildId}`);
  }

  // ======================================================
  // CALLBACK
  // ======================================================

  if (typeof fn !== "function") {
    throw new Error("[withGuild] Brak callbacka fn");
  }

  return fn({
    guildId,
    pool,
  });
}

module.exports = {
  withGuild,
};
