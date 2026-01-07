// utils/teamsState.js
const state = new Map();

function key(guildId, userId) {
  return `${String(guildId || '0')}:${String(userId || '0')}`;
}

module.exports = {
  set(guildId, userId, ctx) {
    if (!guildId || !userId) return;
    state.set(key(guildId, userId), ctx);
  },
  get(guildId, userId) {
    if (!guildId || !userId) return null;
    return state.get(key(guildId, userId)) || null;
  },
  clear(guildId, userId) {
    if (!guildId || !userId) return;
    state.delete(key(guildId, userId));
  }
};
