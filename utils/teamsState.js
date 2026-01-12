// utils/teamsState.js
const state = new Map();

function ensureGuild(guildId) {
  const gid = String(guildId);
  if (!state.has(gid)) state.set(gid, {});
  return state.get(gid);
}

/**
 * Stan usera w danej guildii
 */
function getState(guildId, userId) {
  const gid = String(guildId);
  const uid = String(userId);

  const guildState = ensureGuild(gid);

  if (!guildState[uid]) {
    guildState[uid] = {
      selectedTeamIds: [],
      selectedTeamId: null, // legacy
      page: 0,
      teams: null
    };
  }

  return guildState[uid];
}

/**
 * Nadpisuje fragment stanu
 */
function setState(guildId, userId, data) {
  const s = getState(guildId, userId);
  Object.assign(s, data || {});
  return s;
}

/**
 * Czyści zaznaczenie
 */
function clearSelection(guildId, userId) {
  const s = getState(guildId, userId);
  s.selectedTeamIds = [];
  s.selectedTeamId = null;
  return s;
}

/**
 * Unieważnia cache drużyn (jeśli gdzieś cachujesz listę)
 */
function invalidateTeams(guildId) {
  const gid = String(guildId);
  if (!state.has(gid)) return;

  const guildState = state.get(gid);
  for (const uid of Object.keys(guildState)) {
    guildState[uid].teams = null;
  }
}

/**
 * Legacy API dla starych handlerów:
 * teamsState.get(gid, uid) / teamsState.set(gid, uid, data)
 */
function get(guildId, userId) {
  return getState(guildId, userId);
}
function set(guildId, userId, data) {
  return setState(guildId, userId, data);
}

module.exports = {
  getState,
  setState,
  clearSelection,
  invalidateTeams,
  get,
  set
};
