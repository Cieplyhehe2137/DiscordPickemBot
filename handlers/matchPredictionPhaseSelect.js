const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');

const PAGE_SIZE = 25;


function chunkMatches(matches, page) {

    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    return {
        slice: matches.slice(start, end),
        totalPages: Math.ceil(matches.length / PAGE_SIZE)
    };

}


function buildMatchDropdown(matches, phase, eventId, page) {

    const { slice, totalPages } = chunkMatches(matches, page);

    const options = slice.map(match => {

        const bo = match.best_of ? `Bo${match.best_of}` : "Bo?";

        let label =
            `#${match.match_no} ${match.team_a} vs ${match.team_b} (${bo})`;

        if (label.length > 100) {
            label = label.slice(0, 97) + "...";
        }

        return {

            label,

            value: `match:${match.id}`,

            description: `match #${match.match_no}`

        };

    });


    const dropdown = new StringSelectMenuBuilder()

        .setCustomId(
            `match_select_page:${phase}:${eventId}:${page}`
        )

        .setPlaceholder(
            `Wybierz mecz (${page + 1}/${totalPages})`
        )

        .addOptions(options);


    return new ActionRowBuilder().addComponents(dropdown);

}



function buildPaginationButtons(phase, eventId, page, totalPages) {

    return new ActionRowBuilder().addComponents(

        new ButtonBuilder()

            .setCustomId(
                `match_page_prev:${phase}:${eventId}:${page}`
            )

            .setLabel("⬅️")

            .setStyle(ButtonStyle.Secondary)

            .setDisabled(page === 0),


        new ButtonBuilder()

            .setCustomId("page_info")

            .setLabel(`${page + 1}/${totalPages}`)

            .setStyle(ButtonStyle.Secondary)

            .setDisabled(true),


        new ButtonBuilder()

            .setCustomId(
                `match_page_next:${phase}:${eventId}:${page}`
            )

            .setLabel("➡️")

            .setStyle(ButtonStyle.Secondary)

            .setDisabled(page + 1 >= totalPages)

    );

}



async function getEventId(pool, phase) {

    const [rows] = await pool.query(`

    SELECT event_id

    FROM matches

    WHERE phase = ?

    ORDER BY event_id DESC

    LIMIT 1

  `, [phase]);


    return rows?.[0]?.event_id ?? null;

}



module.exports = async interaction => {

    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId !== "panel:select:match_phase") return;


    const phase = interaction.values[0];


    await interaction.deferReply({ ephemeral: true });


    try {

        await withGuild(interaction, async ({ pool }) => {


            const eventId = await getEventId(pool, phase);


            const [matches] = await pool.query(`

        SELECT *

        FROM matches

        WHERE event_id = ?

        AND phase = ?

        ORDER BY match_no

      `, [eventId, phase]);


            const page = 0;


            const dropdownRow =
                buildMatchDropdown(matches, phase, eventId, page);


            const totalPages =
                Math.ceil(matches.length / PAGE_SIZE);


            const buttonsRow =
                buildPaginationButtons(
                    phase,
                    eventId,
                    page,
                    totalPages
                );


            const embed = new EmbedBuilder()

                .setTitle(
                    "🎯 Wybierz mecz do wytypowania wyniku"
                )

                .setDescription(

                    `faza: ${phase}\n` +

                    `mecze: ${matches.length}`

                );


            return interaction.editReply({

                embeds: [embed],

                components: [

                    dropdownRow,

                    buttonsRow

                ]

            });

        });

    }

    catch (err) {

        console.error(err);


        return interaction.editReply({

            content: "❌ błąd wczytywania meczów"

        });

    }

};