const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const isAdmin =
  require('../../utils/isAdmin');

const {
  withGuild
} = require('../../utils/guildContext');

const {
  logError
} = require('../../utils/logger');


function formatDateForInput(value) {
  if (!value) {
    return '';
  }

  const utcDate =
    new Date(
      String(value)
        .replace(' ', 'T') + 'Z'
    );

  if (
    Number.isNaN(
      utcDate.getTime()
    )
  ) {
    return '';
  }

  const formatter =
    new Intl.DateTimeFormat(
      'sv-SE',
      {
        timeZone:
          'Europe/Warsaw',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',

        hour:
          '2-digit',

        minute:
          '2-digit',

        hourCycle:
          'h23'
      }
    );

  return formatter
    .format(utcDate)
    .replace(',', '');
}


module.exports =
async function editMatchPhase(
  interaction
) {
  try {

    if (
      !interaction.isStringSelectMenu()
    ) {
      return;
    }


    if (
      !String(
        interaction.customId || ''
      ).startsWith(
        'edit_match_phase:'
      )
    ) {
      return;
    }


    if (!isAdmin(interaction)) {
      return interaction.reply({
        content:
          '❌ Brak uprawnień.',
        ephemeral: true
      });
    }


    const matchId =
      Number(
        interaction.customId
          .split(':')[1]
      );


    const phase =
      String(
        interaction.values?.[0] || ''
      );


    const allowedPhases =
      new Set([
        'playin',
        'swiss_stage1',
        'swiss_stage2',
        'swiss_stage3',
        'playoffs',
        'doubleelim'
      ]);


    if (
      !matchId ||
      !allowedPhases.has(phase)
    ) {
      return interaction.reply({
        content:
          '❌ Nieprawidłowe dane meczu.',
        ephemeral: true
      });
    }


    return withGuild(
      interaction,

      async ({
        pool,
        guildId
      }) => {

        const [[match]] =
          await pool.query(
            `
            SELECT
              id,
              event_id,
              team_a,
              team_b,
              best_of,
              match_no,
              start_time_utc

            FROM matches

            WHERE guild_id = ?
              AND id = ?

            LIMIT 1
            `,
            [
              guildId,
              matchId
            ]
          );


        if (!match) {
          return interaction.reply({
            content:
              '❌ Nie znaleziono meczu.',
            ephemeral: true
          });
        }


        const modal =
          new ModalBuilder()
            .setCustomId(
              `edit_match_modal:${match.id}:${phase}`
            )
            .setTitle(
              'Edytuj mecz'
            );


        const teamA =
          new TextInputBuilder()
            .setCustomId('team_a')
            .setLabel('Drużyna A')
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setValue(
              String(
                match.team_a || ''
              )
            );


        const teamB =
          new TextInputBuilder()
            .setCustomId('team_b')
            .setLabel('Drużyna B')
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setValue(
              String(
                match.team_b || ''
              )
            );


        const bestOf =
          new TextInputBuilder()
            .setCustomId('best_of')
            .setLabel(
              'BO (1 / 3 / 5)'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setValue(
              String(
                match.best_of || 3
              )
            );


        const matchNo =
          new TextInputBuilder()
            .setCustomId('match_no')
            .setLabel(
              'Numer meczu'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
              match.match_no == null
                ? ''
                : String(
                    match.match_no
                  )
            );


        const startTime =
          new TextInputBuilder()
            .setCustomId(
              'start_time'
            )
            .setLabel(
              'Start PL: YYYY-MM-DD HH:mm'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(false)
            .setValue(
              formatDateForInput(
                match.start_time_utc
              )
            );


        modal.addComponents(

          new ActionRowBuilder()
            .addComponents(
              teamA
            ),

          new ActionRowBuilder()
            .addComponents(
              teamB
            ),

          new ActionRowBuilder()
            .addComponents(
              bestOf
            ),

          new ActionRowBuilder()
            .addComponents(
              matchNo
            ),

          new ActionRowBuilder()
            .addComponents(
              startTime
            )
        );


        return interaction.showModal(
          modal
        );
      }
    );


  } catch (err) {

    logError(
      'matches',
      'editMatchPhase failed',
      {
        message:
          err.message,

        stack:
          err.stack
      }
    );

  }
};