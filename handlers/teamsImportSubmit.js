// handlers/teamsImportSubmit.js
const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const teamsStore = require('../utils/teamsStore');

module.exports = async function teamsImportSubmit(interaction) {
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const jsonText = interaction.fields.getTextInputValue('teams_json');

    await interaction.deferReply({ ephemeral: true });

    const count = await teamsStore.importTeamsFromJsonText(guildId, jsonText);

    return interaction.editReply({
      content: `✅ Zaimportowano **${count}** drużyn do bazy (tabela \`teams\`).`
    });
  } catch (err) {
    logger.error('teams', 'teamsImportSubmit failed', { message: err.message, stack: err.stack });

    const msg =
      err?.message === 'INVALID_JSON'
        ? '❌ Błędny JSON. Wklej np. `["FaZe","NAVI","G2"]`'
        : '❌ Nie udało się zaimportować drużyn.';

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg });
    }
    return interaction.reply({ content: msg, ephemeral: true });
  }
};
