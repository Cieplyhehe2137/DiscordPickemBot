// utils/matchUserState.js
// Prosty in-memory state na czas flow (ephemeral).
// Klucz: userId, wartość: { matchId, teamA, teamB, bestOf, phase }

const state = new Map();

module.exports = {
  set(userId, ctx) {
    if (!userId) return;
    state.set(String(userId), ctx);
  },
  get(userId) {
    if (!userId) return null;
    return state.get(String(userId)) || null;
  },
  clear(userId) {
    if (!userId) return;
    state.delete(String(userId));
  }
};
