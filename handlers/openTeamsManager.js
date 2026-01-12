// handlers/openTeamsManager.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits
} = require('discord.js');

const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const { listTeams, getTeamNames } = require('../utils/teamsStore');

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function chunk25(arr, page = 0) {
  const p = Math.max(0, Number(page) || 0);
  const start = p * 25;
  const items = arr.slice(start, start + 25);
  return {
    page: p,
    items,
    hasPrev: p > 0,
    hasNext: start + 25 < arr.length,
    total: arr.length
  };
}

function pickSelectedIds(st) {
  if (Array.isArray(st?.selectedTeamIds)) return st.selectedTeamIds;
  if (st?.selectedTeamId) return [Number(st.selectedTeamId)];
  return [];
}

async function render(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const st = teamsState.getState(guildId, userId) || { page: 0, selectedTeamIds: [] };

  const all = await listTeams(guildId, { includeInactive: true });
  const { page, items, hasPrev, hasNext, total } = chunk25(all, st.page);

  const activeCount = all.filter(t => t.active === 1).length;

  const selectedIds = pickSelectedIds(st)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n) && n > 0);

  const selectedSet = new Set(selectedIds);

  const selectedTeams = items.filter(t => selectedSet.has(Number(t.id)));
  const selectedCount = selectedIds.length;

  let selectedLine = '• Wybrane: **brak**';
  if (selectedCount === 1) {
    const t = selectedTeams[0] || all.find(x => Number(x.id) === selectedIds[0]);
    selectedLine = t
      ? `• Wybrana: **${t.name}** (ID: **${t.id}**)`
      : `• Wybrana ID: **${selectedIds[0]}**`;
  } else if (selectedCount > 1) {
    const names = selectedTeams.map(t => t.name).slice(0, 6);
    selectedLine =
      `• Wybrane: **${selectedCount}**` +
      (names.length ? ` (${names.join(', ')}${selectedCount > names.length ? '…' : ''})` : '');
  }

  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('👥 Manager drużyn')
    .setDescription(
      'Zarządzaj listą drużyn w bazie danych (tabela `teams`).\n\n' +
      `• Aktywne: **${activeCount}** / Wszystkie: **${total}**\n` +
      `• Strona: **${page + 1}**\n` +
      selectedLine
    );


  // options for current page
  const optionsRaw = items.map(t => ({
    label: (t.name || '').slice(0, 100),
    value: String(t.id),
    description: t.active === 1 ? 'Aktywna' : 'Nieaktywna',
    default: selectedSet.has(Number(t.id))
  }));

  const hasOptions = optionsRaw.length > 0;

  const maxPick = hasOptions ? Math.min(10, optionsRaw.length) : 1;
  const minPick = hasOptions ? 0 : 1;

  const select = new StringSelectMenuBuilder()
    .setCustomId('teams:select')
    .setPlaceholder(hasOptions ? 'Wybierz drużyny… (możesz kilka)' : 'Brak drużyn')
    .setMinValues(minPick)
    .setMaxValues(maxPick)
    .setDisabled(!hasOptions)
    .addOptions(hasOptions ? optionsRaw : [{ label: 'Brak drużyn', value: 'none' }]);

  const selectRow = new ActionRowBuilder().addComponents(select);

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('teams:page_prev')
      .setLabel('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasPrev),
    new ButtonBuilder()
      .setCustomId('teams:page_next')
      .setLabel('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasNext),
    new ButtonBuilder()
      .setCustomId('teams:refresh')
      .setLabel('🔄 Odśwież')
      .setStyle(ButtonStyle.Secondary)
  );

  // disable buttons based on selection count
  const canSingle = selectedCount === 1;
  const canAny = selectedCount >= 1;

  const actionsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('teams:add').setLabel('➕ Dodaj').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('teams:rename').setLabel('✏️ Zmień nazwę').setStyle(ButtonStyle.Primary).setDisabled(!canSingle),
    new ButtonBuilder().setCustomId('teams:toggle').setLabel('✅/🚫 Aktywuj').setStyle(ButtonStyle.Secondary).setDisabled(!canSingle),
    new ButtonBuilder().setCustomId('teams:delete').setLabel('🗑 Usuń').setStyle(ButtonStyle.Danger).setDisabled(!canAny),
  );


  const ioRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('teams:export').setLabel('📤 Eksport listy').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('teams:import').setLabel('📥 Import listy').setStyle(ButtonStyle.Secondary)
  );


  const activeNames = await getTeamNames(guildId, { includeInactive: false });
  const preview = activeNames.slice(0, 15);
  embed.addFields({
    name: '✅ Aktywne drużyny (podgląd)',
    value: activeNames.length
      ? `${preview.join(' • ')}${activeNames.length > preview.length ? ` … (+${activeNames.length - preview.length})` : ''}`
      : '—'
  });

  return { embeds: [embed], components: [selectRow, navRow, actionsRow, ioRow] };
}

module.exports = async function openTeamsManager(interaction) {
  try {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
    }

    const payload = await render(interaction);

    // update manager message if the interaction comes from teams:* button/select
    const isTeamsComponent =
      (interaction.isButton() || interaction.isStringSelectMenu()) &&
      interaction.customId &&
      interaction.customId.startsWith('teams:');

    if (isTeamsComponent) {
      return interaction.update(payload);
    }

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(payload);
    }
    return interaction.reply({ ...payload, ephemeral: true });
  } catch (err) {
    logger.error('teams', 'openTeamsManager failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Nie udało się otworzyć managera drużyn.', ephemeral: true });
    }
  }
};
