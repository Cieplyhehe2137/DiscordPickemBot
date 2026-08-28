// utils/getOpenEventId.js
//
// Single source of truth for the currently active Pick'Em event.
//
// Event is considered active only when all lifecycle flags agree:
//
//   status    = 'OPEN'
//   is_open   = 1
//   is_active = 1
//
// This prevents stale, scheduled or partially closed events
// from being used when saving predictions.

async function getOpenEventId(pool, guildId) {
  if (!pool || !guildId) {
    return null;
  }

  const [[eventRow]] = await pool.query(
    `
    SELECT id
    FROM events
    WHERE guild_id = ?
      AND status = 'OPEN'
      AND is_open = 1
      AND is_active = 1
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId],
  );

  return eventRow?.id || null;
}

// Backwards-compatible alias.
//
// Older parts of the bot still call getActiveEventId().
// Both functions intentionally resolve the exact same event,
// so there is only one definition of "active event".
async function getActiveEventId(pool, guildId) {
  return getOpenEventId(pool, guildId);
}

module.exports = {
  getOpenEventId,
  getActiveEventId,
};
