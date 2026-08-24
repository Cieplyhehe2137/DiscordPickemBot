const isAdmin = require('../../utils/isAdmin');

const {
  withGuild
} = require('../../utils/guildContext');

const {
  logInfo,
  logError
} = require('../../utils/logger');


module.exports = async function undoMatchResultConfirm(
  interaction
) {
  if (
    !String(interaction.customId || '')
      .startsWith(
        'undo_match_result_confirm:'
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


  const matchId =
    Number(
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


  try {
    await interaction.deferUpdate();


    return withGuild(
      interaction,
      async ({ pool, guildId }) => {

        const [[match]] =
          await pool.query(
            `
            SELECT
              m.id,
              m.event_id,
              m.match_no,
              m.team_a,
              m.team_b,
              m.phase,

              mr.res_a,
              mr.res_b

            FROM matches m

            INNER JOIN match_results mr
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
              'ℹ️ Ten wynik został już wcześniej cofnięty.',
            embeds: [],
            components: []
          });
        }


        const conn =
          await pool.getConnection();


        try {
          await conn.beginTransaction();


          // =====================================
          // 1. PUNKTY ZA MECZ
          // =====================================

          const [pointsResult] =
            await conn.query(
              `
              DELETE FROM match_points
              WHERE guild_id = ?
                AND event_id = ?
                AND match_id = ?
              `,
              [
                guildId,
                match.event_id,
                match.id
              ]
            );


          // =====================================
          // 2. OFICJALNE WYNIKI MAP
          // =====================================

          const [mapsResult] =
            await conn.query(
              `
              DELETE FROM match_map_results
              WHERE guild_id = ?
                AND event_id = ?
                AND match_id = ?
              `,
              [
                guildId,
                match.event_id,
                match.id
              ]
            );


          // =====================================
          // 3. WYNIK SERII
          // =====================================

          const [seriesResult] =
            await conn.query(
              `
              DELETE FROM match_results
              WHERE guild_id = ?
                AND event_id = ?
                AND match_id = ?
              `,
              [
                guildId,
                match.event_id,
                match.id
              ]
            );


          await conn.commit();


          logInfo(
            'matches',
            'Match result reverted',
            {
              guildId,
              eventId:
                match.event_id,
              matchId:
                match.id,

              userId:
                interaction.user.id,

              teamA:
                match.team_a,

              teamB:
                match.team_b,

              oldResult:
                `${match.res_a}:${match.res_b}`,

              removedPointsRows:
                pointsResult.affectedRows,

              removedMapResults:
                mapsResult.affectedRows,

              removedSeriesResults:
                seriesResult.affectedRows
            }
          );


          return interaction.editReply({
            content:
              `✅ **Cofnięto wynik meczu**\n\n` +
              `🎮 **${match.team_a} ${match.res_a}:${match.res_b} ${match.team_b}**\n\n` +
              `Usunięto:\n` +
              `↩️ wynik serii: **${seriesResult.affectedRows}**\n` +
              `🗺️ wyniki map: **${mapsResult.affectedRows}**\n` +
              `⭐ rekordy punktów: **${pointsResult.affectedRows}**\n\n` +
              `✅ Typy użytkowników zostały zachowane.\n\n` +
              `Możesz teraz ponownie wpisać poprawny wynik.`,
            embeds: [],
            components: []
          });


        } catch (err) {

          await conn.rollback();

          throw err;

        } finally {

          conn.release();

        }
      }
    );


  } catch (err) {

    logError(
      'matches',
      'undoMatchResultConfirm failed',
      {
        message: err.message,
        stack: err.stack,
        matchId
      }
    );


    if (
      interaction.deferred ||
      interaction.replied
    ) {
      return interaction.editReply({
        content:
          '❌ Nie udało się cofnąć wyniku. Żadne częściowe zmiany nie zostały zapisane.',
        embeds: [],
        components: []
      }).catch(() => {});
    }


    return interaction.reply({
      content:
        '❌ Nie udało się cofnąć wyniku.',
      ephemeral: true
    }).catch(() => {});
  }
};