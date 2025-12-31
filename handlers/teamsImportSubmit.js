// handlers/teamsImportSubmit.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');
const { importFromJsonText } = require('../utils/teamsStore');

module.exports = async function teamsImportSubmit(interaction) {
  try {
    const guildId = interaction.guildId;
    const text = interaction.fields.getTextInputValue('teams_json');

    await interaction.deferReply({ ephemeral: true });
    const names = await importFromJsonText(guildId, text, { replace: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:open:teams')
        .setLabel('👥 Otwórz manager drużyn')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: `✅ Zaimportowano **${names.length}** drużyn (REPLACE).`,
      components: [row]
    });
  } catch (err) {
    logger.error('teams', 'teamsImportSubmit failed', { message: err.message, stack: err.stack });
    let msg = '❌ Nie udało się zaimportować drużyn.';
    if (err?.message === 'BAD_JSON') msg = '❌ Niepoprawny JSON.';
    if (err?.message === 'BAD_FORMAT') msg = '❌ JSON musi być tablicą (np. ["FaZe","NAVI"]).';
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(msg);
    }
    return interaction.reply({ content: msg, ephemeral: true });
  }
};
