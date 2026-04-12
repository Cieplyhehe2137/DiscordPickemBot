const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { withGuild } = require('../utils/guildContext');

const FIRST_PAGE_MATCHES = 24;
const NEXT_PAGES_MATCHES = 23;

function getTotalPages(totalMatches) {
    if (totalMatches <= 0) return 1;
    if (totalMatches <= FIRST_PAGE_MATCHES) return 1;

    const remaining = totalMatches - FIRST_PAGE_MATCHES;
    return 1 + Math.ceil(remaining / NEXT_PAGES_MATCHES);
}

function getPageSlice(totalMatches, page) {
    if (page < 0) page = 0;

    let start;
    let end;

    if (page === 0) {
        start = 0;
        end = Math.min(FIRST_PAGE_MATCHES, totalMatches);
    } else {
        start = FIRST_PAGE_MATCHES + (page - 1) * NEXT_PAGES_MATCHES;
        end = Math.min(start + NEXT_PAGES_MATCHES, totalMatches);
    }

    const hasPrev = page > 0;
    const hasNext = end < totalMatches;

    return {
        start,
        end,
        hasPrev,
        hasNext,
    };
}

function buildPagedMatchSelect({
    matches,
    phase,
    eventId,
    page = 0
}) {

    const PAGE_SIZE = 25;

    const total = matches.length;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    const slice = matches.slice(start, end);

    const hasPrev = page > 0;
    const hasNext = page < totalPages - 1;

    const options = [];

    // mecze
    for (const match of slice) {

        const teamA = match.team_a || "TBD";
        const teamB = match.team_b || "TBD";
        const bo = match.best_of ? `Bo${match.best_of}` : "Bo?";

        let label =
            `#${match.match_no} ${teamA} vs ${teamB} (${bo})`;

        if (label.length > 100) {
            label = label.slice(0, 97) + "...";
        }

        options.push({

            label,

            value: `match:${match.id}`,

            description: `mecz #${match.match_no}`

        });

    }

    // nawigacja zawsze na dole
    if (hasPrev) {

        options.push({

            label: "⬅️ Poprzednia strona",

            value: "nav:prev",

            description: "wróć do wcześniejszych meczów"

        });

    }

    if (hasNext) {

        options.push({

            label: "➡️ Następna strona",

            value: "nav:next",

            description: "zobacz kolejne mecze"

        });

    }

    return new ActionRowBuilder().addComponents(

        new StringSelectMenuBuilder()

            .setCustomId(
                `match_select_page:${phase}:${eventId}:${page}`
            )

            .setPlaceholder(
                `Wybierz mecz (${page + 1}/${totalPages})`
            )

            .addOptions(options)

    );

}

module.exports = async (interaction) => {
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
        console.error('[matchSelectPage] failed:', err);

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