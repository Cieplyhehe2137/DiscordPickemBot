// utils/matchUserState.js

const STATE_TTL_MS = 30 * 60 * 1000;

const state = new Map();

function makeKey(guildId, userId) {
  if (!guildId) {
    throw new Error("matchUserState: missing guildId");
  }

  if (!userId) {
    throw new Error("matchUserState: missing userId");
  }

  return `${String(guildId)}:${String(userId)}`;
}

function isExpired(entry) {
  return !entry || Date.now() - entry.ts > STATE_TTL_MS;
}

function set(guildId, userId, ctx) {
  if (!ctx) {
    throw new Error("matchUserState.set: missing ctx");
  }

  const key = makeKey(guildId, userId);

  state.set(key, {
    data: ctx,
    ts: Date.now(),
  });
}

function get(guildId, userId) {
  const key = makeKey(guildId, userId);

  const entry = state.get(key);

  if (!entry) {
    return null;
  }

  if (isExpired(entry)) {
    state.delete(key);
    return null;
  }

  // aktywne użycie przedłuża TTL
  entry.ts = Date.now();

  return entry.data;
}

function clear(guildId, userId) {
  const key = makeKey(guildId, userId);

  state.delete(key);
}

function has(guildId, userId) {
  return get(guildId, userId) !== null;
}

module.exports = {
  set,
  get,
  clear,
  has,
};
