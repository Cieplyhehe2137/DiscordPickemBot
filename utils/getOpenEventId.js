// utils/getOpenEventId.js
//
// Resolves the currently OPEN event for a guild - used when saving a
// prediction, where we specifically want "the event accepting picks right
// now" and nothing else.

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
    [guildId],
  );

  return eventRow?.id || null;
}

// Separate from getOpenEventId: some older call sites key off `is_active`
// rather than `status = 'OPEN'`. Kept as its own function rather than
// merged with getOpenEventId, since the two flags may not always agree
// (schema drift flagged for a future DB cleanup pass) - this preserves
// existing behavior for those call sites rather than guessing which flag
// is "more correct".
async function getActiveEventId(pool, guildId) {
  const [[eventRow]] = await pool.query(
    `
    SELECT id
    FROM events
    WHERE guild_id = ?
      AND is_active = 1
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId],
  );

  return eventRow?.id || null;
}

module.exports = { getOpenEventId, getActiveEventId };
