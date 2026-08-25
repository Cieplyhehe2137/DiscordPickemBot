// utils/teamsState.js

const STATE_TTL_MS = 30 * 60 * 1000;

const state = new Map();

const DEFAULT_USER_STATE = () => ({
  selectedTeamIds: [],
  selectedTeamId: null,
  page: 0,
  teams: null,
});

function normalizeId(id, name) {
  if (!id) {
    throw new Error(`teamsState: missing ${name}`);
  }

  return String(id);
}

function ensureGuild(guildId) {
  const gid = normalizeId(guildId, "guildId");

  if (!state.has(gid)) {
    state.set(gid, new Map());
  }

  return state.get(gid);
}

function isExpired(entry) {
  return !entry || Date.now() - entry.ts > STATE_TTL_MS;
}

function getEntry(guildId, userId, create = true) {
  const gid = normalizeId(guildId, "guildId");

  const uid = normalizeId(userId, "userId");

  const guildState = ensureGuild(gid);

  let entry = guildState.get(uid);

  if (entry && isExpired(entry)) {
    guildState.delete(uid);
    entry = null;
  }

  if (!entry && create) {
    entry = {
      data: DEFAULT_USER_STATE(),

      ts: Date.now(),
    };

    guildState.set(uid, entry);
  }

  if (entry) {
    entry.ts = Date.now();
  }

  return {
    gid,
    uid,
    guildState,
    entry,
  };
}

/**
 * Stan usera w danej guildii
 */
function getState(guildId, userId) {
  const { entry } = getEntry(guildId, userId, true);

  return entry.data;
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
 * Unieważnia cache drużyn
 */
function invalidateTeams(guildId) {
  const gid = normalizeId(guildId, "guildId");

  const guildState = state.get(gid);

  if (!guildState) {
    return;
  }

  for (const [uid, entry] of guildState.entries()) {
    if (isExpired(entry)) {
      guildState.delete(uid);
      continue;
    }

    entry.data.teams = null;
  }

  if (guildState.size === 0) {
    state.delete(gid);
  }
}

/**
 * Czyści stan konkretnego usera
 */
function clearUser(guildId, userId) {
  const gid = normalizeId(guildId, "guildId");

  const uid = normalizeId(userId, "userId");

  const guildState = state.get(gid);

  if (!guildState) {
    return;
  }

  guildState.delete(uid);

  if (guildState.size === 0) {
    state.delete(gid);
  }
}

/**
 * Czyści cały stan danej guildii
 */
function resetGuild(guildId) {
  const gid = normalizeId(guildId, "guildId");

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
  clearUser,

  invalidateTeams,
  resetGuild,

  get,
  set,
};
