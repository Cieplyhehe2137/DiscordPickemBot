// handlers/teamsDeleteConfirm.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const { logInfo, logWarn, logError } = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const { deleteTeams, listTeams } = require('../utils/teamsStore');

function getSelectedIds(st) {
  if (Array.isArray(st?.selectedTeamIds)) return st.selectedTeamIds;
  if (st?.selectedTeamId) return [Number(st.selectedTeamId)];
  return [];
}

async function safeEditMessage(interaction, payload) {
  try {
    if (interaction.message?.editable !== false) {
      return await interaction.message.edit(payload);
    }
  } catch (err) {
    logWarn('teams', 'safeEditMessage failed', {
      guildId: interaction.guildId,
      userId: interaction.user?.id || null,
      code: err.code,
      message: err.message
    });
  }

  return null;
}

module.exports = async function teamsDeleteConfirm(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user?.id;

  try {
    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '⛔ Tylko administracja.',
        ephemeral: true
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    const st = teamsState.getState(guildId, userId) || {};
    const ids = getSelectedIds(st)
      .map(Number)
      .filter(n => Number.isFinite(n) && n > 0);

    if (!ids.length) {
      await safeEditMessage(interaction, {
        content: '⚠️ Nie wybrano żadnych drużyn do usunięcia.',
        components: []
      });
      return;
    }

    const all = await listTeams(guildId, { includeInactive: true });
    const byId = new Map(all.map(t => [Number(t.id), t.name]));
    const names = ids.map(id => byId.get(id) || `ID:${id}`);

    await deleteTeams(guildId, ids);

    teamsState.setState(guildId, userId, {
      page: st.page || 0,
      selectedTeamIds: [],
      selectedTeamId: null
    });

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:open:teams')
        .setLabel('👥 Otwórz manager drużyn')
        .setStyle(ButtonStyle.Secondary)
    );

    const preview = names.slice(0, 10).map(n => `• ${n}`).join('\n');
    const extra =
      names.length > 10
        ? `\n… i jeszcze **${names.length - 10}**`
        : '';

    logInfo('teams', 'teams deleted', {
      guildId,
      userId,
      count: ids.length,
      ids
    });

    await safeEditMessage(interaction, {
      content:
        `✅ Usunięto **${ids.length}** drużyn:\n\n` +
        `${preview}${extra}`,
      components: [backRow]
    });

  } catch (err) {
    logError('teams', 'teamsDeleteConfirm failed', {
      guildId,
      userId,
      message: err.message,
      stack: err.stack
    });

    if (!interaction.replied && !interaction.deferred) {
      try {
        return interaction.reply({
          content: '❌ Nie udało się usunąć drużyn.',
          ephemeral: true
        });
      } catch (_) { }
    }

    await safeEditMessage(interaction, {
      content:
        `✅ Usunięto **${ids.length}** drużyn:\n\n` +
        `${preview}${extra}`,
      components: [backRow]
    });

    try {
      await interaction.followUp({
        content: `✅ Usunięto ${ids.length} drużyn.`,
        ephemeral: true
      });
    } catch (_) { }
  }
};