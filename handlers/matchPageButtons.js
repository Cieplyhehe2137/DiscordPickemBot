const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { withGuild } = require("../utils/guildContext");

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

    const bo = match.best_of
      ? `Bo${match.best_of}`
      : "Bo?";

    let label =
      `#${match.match_no} ${match.team_a} vs ${match.team_b} (${bo})`;

    if (label.length > 100) {
      label = label.slice(0, 97) + "...";
    }

    return {

      label,

      value: `match:${match.id}`

    };

  });


  const dropdown = new StringSelectMenuBuilder()

    .setCustomId(
      `match_select_page:${phase}:${eventId}:${page}`
    )

    .setPlaceholder(
      `Wybierz mecz (${page+1}/${totalPages})`
    )

    .addOptions(options);


  return new ActionRowBuilder().addComponents(dropdown);

}



function buildPaginationButtons(
  phase,
  eventId,
  page,
  totalPages
) {

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

      .setLabel(`${page+1}/${totalPages}`)

      .setStyle(ButtonStyle.Secondary)

      .setDisabled(true),


    new ButtonBuilder()

      .setCustomId(
        `match_page_next:${phase}:${eventId}:${page}`
      )

      .setLabel("➡️")

      .setStyle(ButtonStyle.Secondary)

      .setDisabled(page+1 >= totalPages)

  );

}



module.exports = async interaction => {

  if (!interaction.isButton()) return;


  if (
    !interaction.customId.startsWith("match_page_")
  ) return;


  const parts =
    interaction.customId.split(":");


  const direction =
    parts[0].includes("next")
      ? "next"
      : "prev";


  const phase = parts[1];

  const eventId = Number(parts[2]);

  const page = Number(parts[3]);


  const newPage =
    direction === "next"
      ? page + 1
      : page - 1;


  try {

    await withGuild(
      interaction,
      async ({ pool }) => {


        const [matches] =
          await pool.query(`

            SELECT *

            FROM matches

            WHERE event_id = ?

            AND phase = ?

            ORDER BY match_no

          `, [eventId, phase]);


        const dropdownRow =
          buildMatchDropdown(
            matches,
            phase,
            eventId,
            newPage
          );


        const totalPages =
          Math.ceil(matches.length / PAGE_SIZE);


        const buttonsRow =
          buildPaginationButtons(
            phase,
            eventId,
            newPage,
            totalPages
          );


        return interaction.update({

          components: [

            dropdownRow,

            buttonsRow

          ]

        });

      });

  }

  catch (err) {

    console.error(err);

  }

};