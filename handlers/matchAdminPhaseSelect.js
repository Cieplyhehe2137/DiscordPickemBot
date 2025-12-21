// handlers/matchAdminPhaseSelect.js
const logger = require('../utils/logger');
const { sendMatchList } = require('./openMatchPick');

module.exports = async function matchAdminPhaseSelect(interaction) {
  try {
    const phaseKey = interaction.values?.[0];
    if (!phaseKey) return interaction.reply({ content: '❌ Nie wybrano fazy.', ephemeral: true });

    return sendMatchList({ interaction, phaseKey, mode: 'res', page: 0, isUpdate: false });
  } catch (err) {
    logger.error('matches', 'matchAdminPhaseSelect failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Błąd przy wyborze fazy.', ephemeral: true });
    }
  }
};
