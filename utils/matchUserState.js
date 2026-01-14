//utils/matchUserState.js

const state = new Map();

function makeKey(guildId, userId) {
  const gid = guildId ? String(guildId) : "global";
  const uid = userId ? String(userId) : "";
  return `${gid}:${uid}`;
}

function normalizeArgsForSet(a, b, c) {
  if (c !== undefined) return { guildId: a, userId: b, ctx: c };
  return { guildId: null, userId: a, ctx: b };
}

function normalizeArgsForGetClear(a ,b) {
  if (b !== undefined) return { guildId: a, userId: b };
  return { guildId: null, userId: a };
}

module.exports = {
  set(a, b, c) {
    const { guildId, userId, ctx } = normalizeArgsForSet(a, b, c);
    if (!userId) return;
    state.set(makeKey(guildId, userId), ctx);
  },

  get(a, b) {
    const { guildId, userId } = normalizeArgsForGetClear(a, b);
    if (!userId) return null;
    return state.get(makeKey(guildId, userId)) || null;
  },

  clear(a, b) {
    const { guildId, userId } = normalizeArgsForGetClear(a, b);
    if (!userId) return;
    state.delete(makeKey(guildId, userId));
  }
};