// handlers/teamsSeedFromFile.js
const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const { readTeamsJsonFallback, seedFromNames, listTeams } = require('../utils/teamsStore');

module.exports = async function teamsSeedFromFile(interaction) {
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const fromFile = readTeamsJsonFallback();
    if (!fromFile.length) {
      return interaction.reply({ content: '❌ Nie znaleziono żadnych drużyn w teams.json.', ephemeral: true });
    }

    // jeśli DB już ma dane, zrób MERGE, jeśli puste -> REPLACE
    const existing = await listTeams(guildId, { includeInactive: true });
    const replace = existing.length === 0;

    const inserted = await seedFromNames(guildId, fromFile, { replace, syncFiles: true });

    return interaction.reply({
      content:
        `✅ Import z pliku zakończony. Wczytano **${inserted.length}** drużyn (${replace ? 'REPLACE' : 'MERGE'}).\n` +
        `Teraz kliknij **🔄 Odśwież** w managerze, żeby zobaczyć listę.`,
      ephemeral: true
    });
  } catch (err) {
    logger.error('teams', 'teamsSeedFromFile failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Nie udało się zaimportować z teams.json.', ephemeral: true });
    }
  }
};
