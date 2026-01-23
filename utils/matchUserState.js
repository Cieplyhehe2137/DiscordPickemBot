//utils/matchUserState.js

const state = new Map();

function makeKey(guildId, userId) {
  if (!guildId || !userId) return null;
  return `${String(guildId)}:${String(userId)}`;
}


function normalizeArgsForSet(a, b, c) {
  if (c !== undefined) return { guildId: a, userId: b, ctx: c };
  return { guildId: null, userId: a, ctx: b };
}

function normalizeArgsForGetClear(a, b) {
  if (b !== undefined) return { guildId: a, userId: b };
  return { guildId: null, userId: a };
}

module.exports = {
  set(a, b, c) {
    const { guildId, userId, ctx } = normalizeArgsForSet(a, b, c);
    const key = makeKey(guildId, userId);
    if (!key) return;
    state.set(key, ctx);
  },

  get(a, b) {
    const { guildId, userId } = normalizeArgsForGetClear(a, b);
    const key = makeKey(guildId, userId);
    if (!key) return null;
    return state.get(key) || null;
  },

  clear(a, b) {
    const { guildId, userId } = normalizeArgsForGetClear(a, b);
    const key = makeKey(guildId, userId);
    if (!key) return;
    state.delete(key);
  },

};