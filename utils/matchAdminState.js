// utils/matchAdminState.js
//
// In-memory admin flow state (per guild + admin).
// Key: `${guildId}:${adminUserId}`

const adminMatchState = new Map();

function makeKey(guildId, adminUserId) {
  if (!guildId) {
    throw new Error('matchAdminState: missing guildId');
  }
  if (!adminUserId) {
    throw new Error('matchAdminState: missing adminUserId');
  }

  return `${String(guildId)}:${String(adminUserId)}`;
}

function set(guildId, adminUserId, data) {
  if (!data) {
    throw new Error('matchAdminState.set: missing data');
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
  if (!entry) return null;

  return entry.data;
}

function clear(guildId, adminUserId) {
  const key = makeKey(guildId, adminUserId);
  adminMatchState.delete(key);
}

function has(guildId, adminUserId) {
  const key = makeKey(guildId, adminUserId);
  return adminMatchState.has(key);
}

module.exports = {
  set,
  get,
  clear,
  has,
};