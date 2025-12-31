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
    return {
        page: p,
        items: arr.slice(start, start + 25),
        hasPrev: p > 0,
        hasNext: start + 25 < arr.length,
        total: arr.length
    };
}

async function render(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const st = teamsState.get(guildId, userId) || { page: 0, selectedTeamId: null };
    const all = await listTeams(guildId, { includeInactive: true });
    const { page, items, hasPrev, hasNext, total } = chunk25(all, st.page);

    const activeCount = all.filter(t => t.active === 1).length;

    const embed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle('👥 Manager drużyn')
        .setDescription(
            'Zarządzaj listą drużyn w DB. Zmiany automatycznie synchronizują `teams.json` (root oraz `/data/teams.json`).\n\n' +
            `• Aktywne: **${activeCount}** / Wszystkie: **${total}**\n` +
            `• Strona: **${page + 1}**\n` +
            (st.selectedTeamId ? `• Wybrana ID: **${st.selectedTeamId}**` : '• Wybrana: **brak**')
        );

    const options = items.map(t => ({
        label: (t.name || '').slice(0, 100),
        value: String(t.id),
        description: t.active === 1 ? 'Aktywna' : 'Nieaktywna'
    }));

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('teams:select')
            .setPlaceholder(options.length ? 'Wybierz drużynę…' : 'Brak drużyn')
            .setMinValues(1)
            .setMaxValues(1)
            .setDisabled(options.length === 0)
            .addOptions(options.length ? options : [{ label: 'Brak drużyn', value: 'none' }])
    );

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

    const actionsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('teams:add').setLabel('➕ Dodaj').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('teams:rename').setLabel('✏️ Zmień nazwę').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('teams:toggle').setLabel('✅/🚫 Aktywuj').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('teams:delete').setLabel('🗑 Usuń').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('teams:seed_from_file').setLabel('📥 Import z pliku').setStyle(ButtonStyle.Secondary)
    );

    const ioRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('teams:export').setLabel('📤 Export JSON').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('teams:import').setLabel('📥 Import JSON').setStyle(ButtonStyle.Secondary)
    );

    const activeNames = await getTeamNames(guildId, { includeInactive: false });
    embed.addFields({
        name: '✅ Aktywne drużyny (podgląd)',
        value: activeNames.length ? activeNames.slice(0, 15).join(' • ') + (activeNames.length > 15 ? ` … (+${activeNames.length - 15})` : '') : '—'
    });

    return { embeds: [embed], components: [selectRow, navRow, actionsRow, ioRow] };
}

module.exports = async function openTeamsManager(interaction) {
    try {
        if (!isAdmin(interaction)) {
            return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
        }

        const payload = await render(interaction);

        // button:
        // - panel:open:teams -> reply (nowa wiadomość)
        // - teams:* -> update (edytuj managera)
        if (interaction.isButton()) {
            if (interaction.customId && interaction.customId.startsWith('teams:')) {
                return interaction.update(payload);
            }
            return interaction.reply({ ...payload, ephemeral: true });
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
