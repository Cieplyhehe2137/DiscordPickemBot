// handlers/teamsDeleteConfirmOpen.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const teamsState = require('../utils/teamsState');
const { listTeams } = require('../utils/teamsStore');

function getSelectedIds(st) {
  if (Array.isArray(st?.selectedTeamIds)) return st.selectedTeamIds;
  if (st?.selectedTeamId) return [Number(st.selectedTeamId)];
  return [];
}

module.exports = async function teamsDeleteConfirmOpen(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
  }

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const st = teamsState.get(guildId, userId);
  const ids = getSelectedIds(st).map(Number).filter(n => Number.isFinite(n) && n > 0);

  if (!ids.length) {
    return interaction.reply({ content: '⚠️ Najpierw wybierz drużyny z listy.', ephemeral: true });
  }

  const all = await listTeams(guildId, { includeInactive: true });
  const byId = new Map(all.map(t => [Number(t.id), t]));

  const names = ids
    .map(id => byId.get(id)?.name || `ID:${id}`)
    .slice(0, 12);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('teams:delete_yes').setLabel('✅ Usuń').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('teams:delete_no').setLabel('❌ Anuluj').setStyle(ButtonStyle.Secondary)
  );

  const extra = ids.length > names.length ? `\n… i jeszcze **${ids.length - names.length}**` : '';
  const list = names.map(n => `• ${n}`).join('\n') + extra;

  return interaction.reply({
    content:
      `⚠️ Na pewno chcesz usunąć **${ids.length}** drużyn?\n\n${list}`,
    components: [row],
    ephemeral: true
  });
};
