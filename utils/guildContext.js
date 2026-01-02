// utils/guildContext.js
const { AsyncLocalStorage } = require('node:async_hooks');

const als = new AsyncLocalStorage();

function withGuild(guildId, fn) {
  const gid = guildId ? String(guildId) : null;
  return als.run({ guildId: gid }, fn);
}

function getGuildId() {
  const store = als.getStore();
  return store?.guildId || null;
}

module.exports = { withGuild, getGuildId };
