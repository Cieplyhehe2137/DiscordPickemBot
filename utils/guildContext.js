// utils/guildContenxt.js

const { AsyncLocalStorage } = require('node:async_hooks');

const als = new AsyncLocalStorage();

function withGuild(guildId, fn) {
    return als.run({ guildId: guildId ? String(guildId) : null }, fn);
}

function getCurrentGuildId() {
    return als.getStore()?.guildId || null;
}

module.exports = {
    withGuild,
    getCurrentGuildId,
}