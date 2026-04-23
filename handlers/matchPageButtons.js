const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { withGuild } = require('../utils/guildContext');

const FIRST_PAGE_MATCHES = 24;
const NEXT_PAGE_MATCHES = 23;

function getPageData(matches, page) {
    const total = matches.length;

    if (page < 0) page = 0;

    let start;
    let pageMatchLimit;

    if (page === 0) {
        start = 0;
        pageMatchLimit = FIRST_PAGE_MATCHES;
    } else {
        start = FIRST_PAGE_MATCHES + (page - 1) * NEXT_PAGE_MATCHES;
        pageMatchLimit = NEXT_PAGE_MATCHES;
    }

    const end = Math.min(start + pageMatchLimit, total);
    const slice = matches.slice(start, end);

    const hasPrev = page > 0;
    const hasNext = end < total;

    let totalPages = 1;
    if (total > FIRST_PAGE_MATCHES) {
        totalPages =
            1 + Math.ceil((total - FIRST_PAGE_MATCHES) / NEXT_PAGE_MATCHES);
    }

    return {
        page,
        total,
        totalPages,
        start,
        end,
        slice,
        hasPrev,
        hasNext,
    };
}

function buildPagedMatchSelect({ matches, phase, eventId, page = 0 }) {
    const {
        total,
        totalPages,
        start,
        end,
        slice,
        hasPrev,
        hasNext,
    } = getPageData(matches, page);

    const options = [];

    for (const match of slice) {
        const teamA = match.team_a || 'TBD';
        const teamB = match.team_b || 'TBD';
        const bo = match.best_of ? `Bo${match.best_of}` : 'Bo?';

        let label = `#${match.match_no} ${teamA} vs ${teamB} (${bo})`;
        if (label.length > 100) {
            label = label.slice(0, 97) + '...';
        }

        let description = `Mecz #${match.match_no}`;
        if (match.is_locked) description += ' • zablokowany';
        if (description.length > 100) {
            description = description.slice(0, 97) + '...';
        }

        options.push({
            label,
            value: `match:${match.id}`,
            description,
        });
    }

    if (hasPrev) {
        options.push({
            label: '⬅️ Poprzednia strona',
            value: 'nav:prev',
            description: 'Pokaż wcześniejsze mecze',
        });
    }

    if (hasNext) {
        options.push({
            label: '➡️ Następna strona',
            value: 'nav:next',
            description: 'Pokaż kolejne mecze',
        });
    }

    const placeholderStart = total === 0 ? 0 : start + 1;
    const placeholderEnd = end;

    const select = new StringSelectMenuBuilder()
        .setCustomId(`match_select_page:${phase}:${eventId}:${page}`)
        .setPlaceholder(
            `Wybierz mecz... (${placeholderStart}-${placeholderEnd} z ${total}, strona ${page + 1}/${totalPages})`
        )
        .addOptions(options);

    return new ActionRowBuilder().addComponents(select);
}

module.exports = async (interaction) => {
    // console.log('[matchPageButtons] customId =', interaction.customId);
    // console.log('[matchPageButtons] selected =', interaction.values?.[0]);
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('match_select_page:')) return;

    const parts = interaction.customId.split(':');
    const phase = parts[1];
    const eventId = Number(parts[2]);
    const page = Number(parts[3]) || 0;

    const selected = interaction.values?.[0];
    if (!selected) {
        return interaction.reply({
            content: '❌ Nie wybrano żadnej opcji.',
            ephemeral: true,
        });
    }

    try {
        await withGuild(interaction, async ({ pool, guildId }) => {
            const [matches] = await pool.query(
                `
        SELECT
          id,
          event_id,
          guild_id,
          phase,
          match_no,
          team_a,
          team_b,
          best_of,
          is_locked
        FROM matches
        WHERE event_id = ?
          AND guild_id = ?
          AND phase = ?
        ORDER BY match_no ASC, id ASC
        `,
                [eventId, guildId, phase]
            );

            if (!matches || matches.length === 0) {
                return interaction.update({
                    content: '❌ Brak meczów dla tej fazy.',
                    components: [],
                    embeds: [],
                });
            }

            if (selected === 'nav:next') {
                const row = buildPagedMatchSelect({
                    matches,
                    phase,
                    eventId,
                    page: page + 1,
                });

                return interaction.update({
                    components: [row],
                });
            }

            if (selected === 'nav:prev') {
                const row = buildPagedMatchSelect({
                    matches,
                    phase,
                    eventId,
                    page: Math.max(0, page - 1),
                });

                return interaction.update({
                    components: [row],
                });
            }

            if (selected.startsWith('match:')) {
                const matchId = Number(selected.split(':')[1]);
                const match = matches.find((m) => Number(m.id) === matchId);

                if (!match) {
                    return interaction.reply({
                        content: '❌ Nie znaleziono wybranego meczu.',
                        ephemeral: true,
                    });
                }

                const teamA = match.team_a || 'TBD';
                const teamB = match.team_b || 'TBD';
                const bo = match.best_of ? `Bo${match.best_of}` : 'Bo?';

                return interaction.reply({
                    content: `✅ Wybrano mecz: **#${match.match_no} ${teamA} vs ${teamB} (${bo})**\nID meczu: \`${matchId}\``,
                    ephemeral: true,
                });
            }

            return interaction.reply({
                content: '❌ Nieznana akcja.',
                ephemeral: true,
            });
        });
    } catch (err) {
        console.error('[matchPageButtons] failed:', err);

        if (interaction.deferred || interaction.replied) {
            return interaction.editReply({
                content: `❌ Błąd: ${err.message}`,
                components: [],
            });
        }

        return interaction.reply({
            content: `❌ Błąd: ${err.message}`,
            ephemeral: true,
        });
    }
};