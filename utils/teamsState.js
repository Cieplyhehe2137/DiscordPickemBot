const state = new Map();

/**
 * Zwraca stan usera w danej guildii
 */
function getState(guildId, userId) {
  if (!state.has(guildId)) {
    state.set(guildId, {});
  }

  const guildState = state.get(guildId);

  if (!guildState[userId]) {
    guildState[userId] = {
      selectedTeamIds: [],
      page: 0,
      teams: null
    };
  }

  return guildState[userId];
}

/**
 * Nadpisuje fragment stanu
 */
function setState(guildId, userId, data) {
  const s = getState(guildId, userId);
  Object.assign(s, data);
}

/**
 * Czyści tylko zaznaczenie
 */
function clearSelection(guildId, userId) {
  const s = getState(guildId, userId);
  s.selectedTeamIds = [];
}

/**
 * 🔥 KLUCZOWE – unieważnia cache drużyn
 */
function invalidateTeams(guildId) {
  if (!state.has(guildId)) return;

  const guildState = state.get(guildId);
  for (const userId of Object.keys(guildState)) {
    guildState[userId].teams = null;
  }
}

module.exports = {
  getState,
  setState,
  clearSelection,
  invalidateTeams
};
