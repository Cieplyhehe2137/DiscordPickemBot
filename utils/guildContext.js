// utils/guildContext.js
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

function withGuild(guildId, fn) {
  const gid = String(guildId || '').trim();
  if (!gid) throw new Error('withGuild: guildId is required');
  return als.run({ guildId: gid }, fn);
}

function getCurrentGuildId() {
  return als.getStore()?.guildId || null;
}

// Alias (gdyby inne pliki używały starych nazw)
function getGuildId() {
  return getCurrentGuildId();
}

module.exports = {
  withGuild,
  getCurrentGuildId,
  getGuildId, // alias
};
