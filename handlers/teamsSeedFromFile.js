// handlers/teamsSeedFromFile.js
const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const {
  readTeamsJsonFallback,
  seedFromNames,
  listTeams
} = require('../utils/teamsStore');

module.exports = async function teamsSeedFromFile(interaction) {
  try {
    // 🔐 admin only
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '⛔ Tylko administracja.',
        ephemeral: true
      });
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta akcja musi być wykonana na serwerze (nie w DM).',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // ===============================
    // LOAD FILE
    // ===============================
    const fromFile = readTeamsJsonFallback();

    if (!Array.isArray(fromFile) || fromFile.length === 0) {
      return interaction.editReply(
        '❌ Nie znaleziono żadnych drużyn w pliku `teams.json`.'
      );
    }

    // ===============================
    // DETERMINE MODE
    // ===============================
    const existing = await listTeams(guildId, { includeInactive: true });
    const replace = existing.length === 0;

    // ===============================
    // SEED
    // ===============================
    const inserted = await seedFromNames(
      guildId,
      fromFile,
      {
        replace,
        syncFiles: true
      }
    );

    return interaction.editReply({
      content:
        `✅ Import z pliku zakończony.\n\n` +
        `• Wczytano: **${inserted.length}** drużyn\n` +
        `• Tryb: **${replace ? 'REPLACE (pusta baza)' : 'MERGE (uzupełnienie)'}**\n\n` +
        `👉 Kliknij **🔄 Odśwież** w managerze drużyn, aby zobaczyć aktualną listę.`
    });

  } catch (err) {
    logger.error('teams', 'teamsSeedFromFile failed', {
      message: err.message,
      stack: err.stack
    });

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(
        '❌ Nie udało się zaimportować drużyn z `teams.json`.'
      );
    }

    return interaction.reply({
      content: '❌ Nie udało się zaimportować drużyn z `teams.json`.',
      ephemeral: true
    });
  }
};
