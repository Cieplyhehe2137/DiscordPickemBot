// utils/matchUserState.js

const state = new Map();

function makeKey(guildId, userId) {
  if (!guildId) {
    throw new Error('matchUserState: missing guildId');
  }
  if (!userId) {
    throw new Error('matchUserState: missing userId');
  }

  return `${String(guildId)}:${String(userId)}`;
}

module.exports = {
  set(guildId, userId, ctx) {
    if (!ctx) {
      throw new Error('matchUserState.set: missing ctx');
    }

    const key = makeKey(guildId, userId);
    state.set(key, ctx);
  },

  get(guildId, userId) {
    const key = makeKey(guildId, userId);
    return state.get(key) || null;
  },

  clear(guildId, userId) {
    const key = makeKey(guildId, userId);
    state.delete(key);
  },

  has(guildId, userId) {
    const key = makeKey(guildId, userId);
    return state.has(key);
  },
};