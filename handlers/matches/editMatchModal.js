const isAdmin = require('../../utils/isAdmin');

const {
  withGuild
} = require('../../utils/guildContext');

const {
  logInfo,
  logError
} = require('../../utils/logger');


function parseStartTime(value) {
  const raw =
    String(value || '').trim();

  if (!raw) {
    return null;
  }

  const normalized =
    raw.replace(' ', 'T');

  const date =
    new Date(`${normalized}:00Z`);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return undefined;
  }

  return date
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}


module.exports = async function editMatchModal(
  interaction
) {
  try {
    if (!interaction.isModalSubmit()) {
      return;
    }

    if (
      !String(
        interaction.customId || ''
      ).startsWith(
        'edit_match_modal:'
      )
    ) {
      return;
    }


    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: '❌ Brak uprawnień.',
        ephemeral: true
      });
    }


    const matchId = Number(
      String(interaction.customId)
        .split(':')[1]
    );


    if (!matchId) {
      return interaction.reply({
        content:
          '❌ Nieprawidłowe ID meczu.',
        ephemeral: true
      });
    }


    const teamA =
      interaction.fields
        .getTextInputValue('team_a')
        .trim();


    const teamB =
      interaction.fields
        .getTextInputValue('team_b')
        .trim();


    const bestOf =
      Number(
        interaction.fields
          .getTextInputValue('best_of')
      );


    const matchNoRaw =
      interaction.fields
        .getTextInputValue('match_no')
        .trim();


    const startRaw =
      interaction.fields
        .getTextInputValue('start_time')
        .trim();


    if (
      !teamA ||
      !teamB
    ) {
      return interaction.reply({
        content:
          '❌ Nazwy obu drużyn są wymagane.',
        ephemeral: true
      });
    }


    if (
      ![1, 3, 5].includes(bestOf)
    ) {
      return interaction.reply({
        content:
          '❌ BO musi wynosić 1, 3 albo 5.',
        ephemeral: true
      });
    }


    const matchNo =
      matchNoRaw
        ? Number(matchNoRaw)
        : null;


    if (
      matchNoRaw &&
      (
        !Number.isInteger(matchNo) ||
        matchNo <= 0
      )
    ) {
      return interaction.reply({
        content:
          '❌ Numer meczu musi być dodatnią liczbą całkowitą.',
        ephemeral: true
      });
    }


    const startTime =
      parseStartTime(startRaw);


    if (
      startRaw &&
      startTime === undefined
    ) {
      return interaction.reply({
        content:
          '❌ Nieprawidłowa data. Użyj formatu: `YYYY-MM-DD HH:mm`.',
        ephemeral: true
      });
    }


    await interaction.deferReply({
      ephemeral: true
    });


    return withGuild(
      interaction,
      async ({ pool, guildId }) => {

        const [[match]] =
          await pool.query(
            `
            SELECT
              m.id,
              m.event_id,
              m.team_a,
              m.team_b,
              m.best_of,
              m.match_no,
              m.start_time_utc,

              CASE
                WHEN mr.match_id IS NOT NULL
                THEN 1
                ELSE 0
              END AS has_result

            FROM matches m

            LEFT JOIN match_results mr
              ON mr.guild_id = m.guild_id
             AND mr.event_id = m.event_id
             AND mr.match_id = m.id

            WHERE m.guild_id = ?
              AND m.id = ?

            LIMIT 1
            `,
            [
              guildId,
              matchId
            ]
          );


        if (!match) {
          return interaction.editReply({
            content:
              '❌ Nie znaleziono meczu.'
          });
        }


        const hasResult =
          Number(match.has_result) === 1;


        // =========================================
        // ROZLICZONY MECZ
        // =========================================

        if (hasResult) {
          const changedTeams =
            teamA !== String(match.team_a) ||
            teamB !== String(match.team_b);

          const changedBo =
            bestOf !==
            Number(match.best_of);


          if (
            changedTeams ||
            changedBo
          ) {
            return interaction.editReply({
              content:
                '❌ **Ten mecz jest już rozliczony.**\n\n' +
                'Nie możesz zmienić drużyn ani BO.\n' +
                'Najpierw użyj **↩️ Cofnij wynik**, a potem edytuj mecz.'
            });
          }
        }


        // =========================================
        // UPDATE
        // =========================================

        await pool.query(
          `
          UPDATE matches
          SET
            team_a = ?,
            team_b = ?,
            best_of = ?,
            match_no = ?,
            start_time_utc = ?

          WHERE guild_id = ?
            AND id = ?

          LIMIT 1
          `,
          [
            teamA,
            teamB,
            bestOf,
            matchNo,
            startTime,
            guildId,
            matchId
          ]
        );


        logInfo(
          'matches',
          'Match edited',
          {
            guildId,
            eventId:
              match.event_id,

            matchId,

            userId:
              interaction.user.id,

            before: {
              teamA:
                match.team_a,

              teamB:
                match.team_b,

              bestOf:
                match.best_of,

              matchNo:
                match.match_no,

              startTime:
                match.start_time_utc
            },

            after: {
              teamA,
              teamB,
              bestOf,
              matchNo,
              startTime
            }
          }
        );


        return interaction.editReply({
          content:
            `✅ **Mecz zaktualizowany**\n\n` +
            `🎮 **${teamA} vs ${teamB}**\n` +
            `📋 BO: **${bestOf}**\n` +
            `🔢 Numer: **${matchNo ?? 'brak'}**\n` +
            `🕒 Start UTC: **${startTime || 'brak'}**`
        });
      }
    );


  } catch (err) {

    logError(
      'matches',
      'editMatchModal failed',
      {
        message: err.message,
        stack: err.stack
      }
    );


    if (
      interaction.deferred ||
      interaction.replied
    ) {
      return interaction.editReply({
        content:
          '❌ Nie udało się zapisać zmian meczu.'
      }).catch(() => {});
    }


    return interaction.reply({
      content:
        '❌ Nie udało się zapisać zmian meczu.',
      ephemeral: true
    }).catch(() => {});
  }
};