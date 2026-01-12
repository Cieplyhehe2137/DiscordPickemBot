// handlers/teamsAddSubmit.js
const logger = require('../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { addTeam } = require('../utils/teamsStore');

module.exports = async function teamsAddSubmit(interaction) {
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const name = interaction.fields.getTextInputValue('team_name')?.trim();
    const shortName = interaction.fields.getTextInputValue('team_short')?.trim() || null;

    if (!name) {
      return interaction.reply({ content: '⚠️ Podaj nazwę drużyny.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    // DB
    await addTeam(guildId, name, { shortName });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:open:teams')
        .setLabel('👥 Otwórz manager drużyn')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: `✅ Dodano drużynę: **${name}**`,
      components: [row]
    });
  } catch (err) {
    logger.error('teams', 'teamsAddSubmit failed', { message: err.message, stack: err.stack });

    const msg =
      err?.code === 'ER_DUP_ENTRY'
        ? '⚠️ Taka drużyna już istnieje na tym serwerze.'
        : '❌ Nie udało się dodać drużyny.';

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg, components: [] });
    }
    return interaction.reply({ content: msg, ephemeral: true });
  }
};
