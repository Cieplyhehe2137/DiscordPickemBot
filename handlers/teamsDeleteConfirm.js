// handlers/teamsDeleteConfirm.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const { deleteTeams, listTeams } = require('../utils/teamsStore');

function getSelectedIds(st) {
  if (Array.isArray(st?.selectedTeamIds)) return st.selectedTeamIds;
  if (st?.selectedTeamId) return [Number(st.selectedTeamId)];
  return [];
}

module.exports = async function teamsDeleteConfirm(interaction) {
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const st = teamsState.getState(guildId, userId);
    const ids = getSelectedIds(st).map(Number).filter(n => Number.isFinite(n) && n > 0);

    if (!ids.length) {
      return interaction.update({ content: '⚠️ Brak zaznaczonych drużyn.', components: [] });
    }

    // Optional: build nice summary
    const all = await listTeams(guildId, { includeInactive: true });
    const byId = new Map(all.map(t => [Number(t.id), t.name]));
    const names = ids.map(id => byId.get(id) || `ID:${id}`);

    await deleteTeams(guildId, ids);

    // clear selection after delete
    teamsState.setState(guildId, userId, { page: st?.page || 0, selectedTeamIds: [], selectedTeamId: null });

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:open:teams')
        .setLabel('👥 Otwórz manager drużyn')
        .setStyle(ButtonStyle.Secondary)
    );

    const preview = names.slice(0, 10).map(n => `• ${n}`).join('\n');
    const extra = names.length > 10 ? `\n… i jeszcze **${names.length - 10}**` : '';

    return interaction.update({
      content:
        `✅ Usunięto **${ids.length}** drużyn.\n\n${preview}${extra}`,
      components: [backRow]
    });
  } catch (err) {
    logger.error('teams', 'teamsDeleteConfirm failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Nie udało się usunąć drużyn.', ephemeral: true });
    }
  }
};
