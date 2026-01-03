// utils/isAdmin.js

const { PermissionFlagsBits } = require('discord.js');

module.exports = function isAdmin(interaction) {
    if (!interaction) return false;

    return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}