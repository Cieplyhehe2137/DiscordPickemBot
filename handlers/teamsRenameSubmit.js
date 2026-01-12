// handlers/teamsRenameSubmit.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const { renameTeam } = require('../utils/teamsStore');

function getSelectedIds(st) {
  if (Array.isArray(st?.selectedTeamIds)) return st.selectedTeamIds;
  if (st?.selectedTeamId) return [Number(st.selectedTeamId)];
  return [];
}

module.exports = async function teamsRenameSubmit(interaction) {
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const st = teamsState.getState(guildId, userId);
    const ids = getSelectedIds(st).map(Number).filter(n => Number.isFinite(n) && n > 0);

    if (ids.length !== 1) {
      return interaction.reply({ content: '⚠️ Do zmiany nazwy wybierz dokładnie **1** drużynę.', ephemeral: true });
    }

    const teamId = ids[0];
    const newName = interaction.fields.getTextInputValue('team_name')?.trim();
    const newShort = interaction.fields.getTextInputValue('team_short')?.trim() || null;

    if (!newName) {
      return interaction.reply({ content: '⚠️ Podaj nową nazwę drużyny.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    await renameTeam(guildId, teamId, newName, { shortName: newShort });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:open:teams')
        .setLabel('👥 Otwórz manager drużyn')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: `✅ Zmieniono nazwę na **${newName}**`,
      components: [row]
    });
  } catch (err) {
    logger.error('teams', 'teamsRenameSubmit failed', { message: err.message, stack: err.stack });

    const msg =
      err?.code === 'ER_DUP_ENTRY'
        ? '⚠️ Taka nazwa już istnieje na tym serwerze.'
        : '❌ Nie udało się zmienić nazwy drużyny.';

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg, components: [] });
    }
    return interaction.reply({ content: msg, ephemeral: true });
  }
};
