// utils/teamsState.js
const state = new Map();

const DEFAULT_USER_STATE = () => ({
  selectedTeamIds: [],
  selectedTeamId: null, // legacy
  page: 0,
  teams: null,
});

function normalizeId(id, name) {
  if (!id) throw new Error(`teamsState: missing ${name}`);
  return String(id);
}

function ensureGuild(guildId) {
  const gid = normalizeId(guildId, 'guildId');
  if (!state.has(gid)) state.set(gid, {});
  return state.get(gid);
}

/**
 * Stan usera w danej guildii
 */
function getState(guildId, userId) {
  const gid = normalizeId(guildId, 'guildId');
  const uid = normalizeId(userId, 'userId');

  const guildState = ensureGuild(gid);

  if (!guildState[uid]) {
    guildState[uid] = DEFAULT_USER_STATE();
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
  const gid = normalizeId(guildId, 'guildId');
  const guildState = state.get(gid);
  if (!guildState) return;

  for (const uid of Object.keys(guildState)) {
    guildState[uid].teams = null;
  }
}

/**
 * (opcjonalne, ale polecam)
 * Czyści cały stan danej guildii
 */
function resetGuild(guildId) {
  const gid = normalizeId(guildId, 'guildId');
  state.delete(gid);
}

/**
 * Legacy API
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
  resetGuild, // ⬅️ nowy, ale nie psuje nic
  get,
  set,
};
