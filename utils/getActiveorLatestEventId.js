// utils/getActiveOrLatestEventId.js

async function getActiveOrLatestEventId(pool, guildId) {
  if (!pool || typeof pool.query !== "function") {
    throw new Error("getActiveOrLatestEventId: invalid pool");
  }

  if (!guildId) {
    throw new Error("getActiveOrLatestEventId: missing guildId");
  }

  // 1. Najpierw próbujemy aktywny event
  try {
    const [activeRows] = await pool.query(
      `
      SELECT id
      FROM events
      WHERE guild_id = ?
        AND is_active = 1
      ORDER BY id DESC
      LIMIT 1
      `,
      [guildId]
    );

    if (activeRows?.[0]?.id) {
      return activeRows[0].id;
    }
  } catch (err) {
    // Fallback, jeśli np. nie masz kolumny is_active
  }

  // 2. Fallback: najnowszy event
  const [latestRows] = await pool.query(
    `
    SELECT id
    FROM events
    WHERE guild_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId]
  );

  if (latestRows?.[0]?.id) {
    return latestRows[0].id;
  }

  // 3. Fallback: event_id z matches
  try {
    const [matchRows] = await pool.query(
      `
      SELECT event_id AS id
      FROM matches
      WHERE guild_id = ?
        AND event_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 1
      `,
      [guildId]
    );

    if (matchRows?.[0]?.id) {
      return matchRows[0].id;
    }
  } catch (err) {}

  throw new Error(`Nie znaleziono aktywnego ani ostatniego eventu dla guildId=${guildId}`);
}

module.exports = {
  getActiveOrLatestEventId,
};