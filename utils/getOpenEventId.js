// utils/getOpenEventId.js
//
// Resolves the currently OPEN event for a guild - used when saving a
// prediction, where we specifically want "the event accepting picks right
// now" and nothing else. Distinct from getActiveOrLatestEventId, which
// falls back to the latest/closed event for read-only reporting.

async function getOpenEventId(pool, guildId) {
  const [[eventRow]] = await pool.query(
    `
    SELECT id
    FROM events
    WHERE guild_id = ?
      AND status = 'OPEN'
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId]
  );

  return eventRow?.id || null;
}

module.exports = { getOpenEventId };
