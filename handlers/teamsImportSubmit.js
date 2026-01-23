// handlers/teamsImportSubmit.js
const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const teamsStore = require('../utils/teamsStore');

module.exports = async function teamsImportSubmit(interaction) {
  try {
    // tylko serwer
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    // tylko admin
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '⛔ Tylko administracja.',
        ephemeral: true
      });
    }

    const guildId = interaction.guildId;
    const jsonText = interaction.fields.getTextInputValue('teams_json');

    if (!jsonText || !jsonText.trim()) {
      return interaction.reply({
        content: '⚠️ Pole z JSON-em nie może być puste.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await teamsStore.importTeamsFromJsonText(guildId, jsonText);
    // result może być liczbą albo obiektem – zabezpieczamy się
    const imported = typeof result === 'number' ? result : result?.imported ?? 0;

    return interaction.editReply({
      content: `✅ Zaimportowano **${imported}** drużyn do bazy (tabela \`teams\`).`
    });

  } catch (err) {
    logger.error('teams', 'teamsImportSubmit failed', {
      guildId: interaction.guildId,
      userId: interaction.user?.id,
      message: err.message,
      stack: err.stack
    });

    let msg = '❌ Nie udało się zaimportować drużyn.';

    if (err?.message === 'INVALID_JSON') {
      msg = '❌ Błędny JSON. Przykład poprawnego formatu:\n`["FaZe","NAVI","G2"]`';
    } else if (err?.message === 'NO_VALID_TEAMS') {
      msg = '⚠️ Nie znaleziono żadnych poprawnych nazw drużyn w danych.';
    } else if (err?.code === 'ER_DUP_ENTRY') {
      msg = '⚠️ Część drużyn już istnieje w bazie.';
    }

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg });
    }

    return interaction.reply({
      content: msg,
      ephemeral: true
    });
  }
};
