// utils/matchAdminState.js
//
// In-memory admin flow state (per guild + admin).
// Key: `${guildId}:${adminUserId}`

const STATE_TTL_MS = 30 * 60 * 1000;

const adminMatchState = new Map();

function makeKey(guildId, adminUserId) {
  if (!guildId) {
    throw new Error("matchAdminState: missing guildId");
  }

  if (!adminUserId) {
    throw new Error("matchAdminState: missing adminUserId");
  }

  return `${String(guildId)}:${String(adminUserId)}`;
}

function isExpired(entry) {
  return !entry || Date.now() - entry.ts > STATE_TTL_MS;
}

function set(guildId, adminUserId, data) {
  if (!data) {
    throw new Error("matchAdminState.set: missing data");
  }

  const key = makeKey(guildId, adminUserId);

  adminMatchState.set(key, {
    data,
    ts: Date.now(),
  });
}

function get(guildId, adminUserId) {
  const key = makeKey(guildId, adminUserId);

  const entry = adminMatchState.get(key);

  if (!entry) {
    return null;
  }

  if (isExpired(entry)) {
    adminMatchState.delete(key);
    return null;
  }

  // aktywne użycie przedłuża TTL
  entry.ts = Date.now();

  return entry.data;
}

function clear(guildId, adminUserId) {
  const key = makeKey(guildId, adminUserId);

  adminMatchState.delete(key);
}

function has(guildId, adminUserId) {
  return get(guildId, adminUserId) !== null;
}

module.exports = {
  set,
  get,
  clear,
  has,
};
