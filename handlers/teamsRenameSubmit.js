// handlers/teamsRenameSubmit.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const { renameTeam } = require('../utils/teamsStore');

module.exports = async function teamsRenameSubmit(interaction) {
  try {
    // 🔐 admin only
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '⛔ Tylko administracja.',
        ephemeral: true
      });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta akcja musi być wykonana na serwerze (nie w DM).',
        ephemeral: true
      });
    }

    const st = teamsState.getState(guildId, userId);

    // 🔑 JEDYNE źródło prawdy
    const teamId = Number(st?.renamingTeamId);

    if (!Number.isFinite(teamId) || teamId <= 0) {
      return interaction.reply({
        content: '⚠️ Nie znaleziono drużyny do zmiany nazwy. Otwórz manager i spróbuj ponownie.',
        ephemeral: true
      });
    }

    const newName = interaction.fields.getTextInputValue('team_name')?.trim();
    const newShort =
      interaction.fields.getTextInputValue('team_short')?.trim() || null;

    if (!newName) {
      return interaction.reply({
        content: '⚠️ Podaj nową nazwę drużyny.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // ===============================
    // DB
    // ===============================
    await renameTeam(guildId, teamId, newName, {
      shortName: newShort
    });

    // 🧹 cleanup stanu
    teamsState.setState(guildId, userId, {
      page: st?.page || 0,
      selectedTeamIds: [],
      selectedTeamId: null,
      renamingTeamId: null
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:open:teams')
        .setLabel('👥 Otwórz manager drużyn')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: `✅ Zmieniono nazwę drużyny na **${newName}**`,
      components: [row]
    });

  } catch (err) {
    logger.error('teams', 'teamsRenameSubmit failed', {
      message: err.message,
      stack: err.stack
    });

    const msg =
      err?.code === 'ER_DUP_ENTRY'
        ? '⚠️ Taka nazwa już istnieje na tym serwerze.'
        : '❌ Nie udało się zmienić nazwy drużyny.';

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg, components: [] });
    }

    return interaction.reply({
      content: msg,
      ephemeral: true
    });
  }
};
