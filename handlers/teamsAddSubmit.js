// handlers/teamsAddSubmit.js
const logger = require('../utils/logger');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const { addTeam } = require('../utils/teamsStore');

function normalizeName(str) {
  return String(str)
    .trim()
    .replace(/\s+/g, ' ');
}

module.exports = async function teamsAddSubmit(interaction) {
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

    const rawName = interaction.fields.getTextInputValue('team_name');
    const rawShort = interaction.fields.getTextInputValue('team_short');

    const name = normalizeName(rawName);
    const shortName = rawShort ? normalizeName(rawShort) : null;

    if (!name || name.length < 2) {
      return interaction.reply({
        content: '⚠️ Nazwa drużyny jest za krótka.',
        ephemeral: true
      });
    }

    if (name.length > 100) {
      return interaction.reply({
        content: '⚠️ Nazwa drużyny jest za długa (max 100 znaków).',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // zapis do DB
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
    logger.error('teams', 'teamsAddSubmit failed', {
      guildId: interaction.guildId,
      userId: interaction.user?.id,
      message: err.message,
      stack: err.stack
    });

    let msg = '❌ Nie udało się dodać drużyny.';

    if (
      err?.code === 'ER_DUP_ENTRY' ||
      /duplicate/i.test(err?.message)
    ) {
      msg = '⚠️ Taka drużyna już istnieje na tym serwerze.';
    }

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg, components: [] });
    }

    return interaction.reply({
      content: msg,
      ephemeral: true
    });
  }
};
