// utils/matchAdminState.js
//
// In-memory admin flow state (per guild + admin).
// Key: `${guildId}:${adminUserId}`
// Value example: { matchId, teamA, teamB, bestOf }
//
// Backward compatible:
//   set(adminUserId, data)
//   get(adminUserId)
//   clear(adminUserId)

const adminMatchState = new Map();
// Map<key, { data, ts }>

const SEP = ':';
const GLOBAL_GUILD = 'global';
// const TTL_MS = 10 * 60 * 1000; // ⏱ opcjonalnie (np. 10 min)

function makeKey(guildId, adminUserId) {
  const gid = guildId ? String(guildId) : GLOBAL_GUILD;
  const uid = adminUserId ? String(adminUserId) : '';
  return `${gid}${SEP}${uid}`;
}

/* ===============================
   ARG NORMALIZATION
   =============================== */

function normalizeSetArgs(a, b, c) {
  // set(guildId, adminUserId, data)
  if (c !== undefined) {
    return { guildId: a, adminUserId: b, data: c };
  }
  // legacy: set(adminUserId, data)
  return { guildId: null, adminUserId: a, data: b };
}

function normalizeGetClearArgs(a, b) {
  // get(guildId, adminUserId) / clear(guildId, adminUserId)
  if (b !== undefined) {
    return { guildId: a, adminUserId: b };
  }
  // legacy: get(adminUserId) / clear(adminUserId)
  return { guildId: null, adminUserId: a };
}

/* ===============================
   PUBLIC API
   =============================== */

function set(a, b, c) {
  const { guildId, adminUserId, data } = normalizeSetArgs(a, b, c);
  if (!adminUserId || !data) return;

  const key = makeKey(guildId, adminUserId);
  adminMatchState.set(key, {
    data,
    ts: Date.now(),
  });
}

function get(a, b) {
  const { guildId, adminUserId } = normalizeGetClearArgs(a, b);
  if (!adminUserId) return null;

  const key = makeKey(guildId, adminUserId);
  const entry = adminMatchState.get(key);
  if (!entry) return null;

  // ⏱ TTL (opcjonalnie)
  // if (Date.now() - entry.ts > TTL_MS) {
  //   adminMatchState.delete(key);
  //   return null;
  // }

  return entry.data;
}

function clear(a, b) {
  const { guildId, adminUserId } = normalizeGetClearArgs(a, b);
  if (!adminUserId) return;

  adminMatchState.delete(makeKey(guildId, adminUserId));
}

function has(a, b) {
  const { guildId, adminUserId } = normalizeGetClearArgs(a, b);
  if (!adminUserId) return false;

  return adminMatchState.has(makeKey(guildId, adminUserId));
}

module.exports = {
  set,
  get,
  clear,
  has,
};
