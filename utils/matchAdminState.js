// utils/matchAdminState.js
// In-memory state admin flow.
// Klucz docelowy: guildId:adminUserId, value: { matchId, teamA, teamB, bestOf }
// Backward compatible: set(adminUserId, data) / get(adminUserId) / clear(adminUserId) -> key "global:adminUserId"

const adminMatchState = new Map();

function makeKey(guildId, adminUserId) {
  const gid = guildId ? String(guildId) : "global";
  const uid = adminUserId ? String(adminUserId) : "";
  return `${gid}:${uid}`;
}

function normalizeArgsForSet(a, b, c) {
  // set(guildId, adminUserId, data)
  if (c !== undefined) return { guildId: a, adminUserId: b, data: c };
  // legacy: set(adminUserId, data)
  return { guildId: null, adminUserId: a, data: b };
}

function normalizeArgsForGetClear(a, b) {
  // get(guildId, adminUserId) / clear(guildId, adminUserId)
  if (b !== undefined) return { guildId: a, adminUserId: b };
  // legacy: get(adminUserId) / clear(adminUserId)
  return { guildId: null, adminUserId: a };
}

module.exports = {
  set(a, b, c) {
    const { guildId, adminUserId, data } = normalizeArgsForSet(a, b, c);
    if (!adminUserId) return;
    adminMatchState.set(makeKey(guildId, adminUserId), data);
  },

  get(a, b) {
    const { guildId, adminUserId } = normalizeArgsForGetClear(a, b);
    if (!adminUserId) return null;
    return adminMatchState.get(makeKey(guildId, adminUserId)) || null;
  },

  clear(a, b) {
    const { guildId, adminUserId } = normalizeArgsForGetClear(a, b);
    if (!adminUserId) return;
    adminMatchState.delete(makeKey(guildId, adminUserId));
  }
};
