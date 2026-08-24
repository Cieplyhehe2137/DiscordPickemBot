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
      .startsWith('undo_match_result_confirm:')
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
      content: '❌ Nieprawidłowe ID meczu.',
      ephemeral: true
    });
  }


  try {
    await interaction.deferUpdate();


    return withGuild(
      interaction,
      async ({ pool, guildId }) => {

        // =========================================
        // POBIERAMY MECZ
        // =========================================

        const [[match]] = await pool.query(
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
              '❌ Nie znaleziono tego meczu.',
            embeds: [],
            components: []
          });
        }


        const oldResult =
          match.res_a != null &&
          match.res_b != null
            ? `${match.res_a}:${match.res_b}`
            : 'brak';


        const conn =
          await pool.getConnection();


        let pointsResult;
        let mapsResult;
        let seriesResult;
        let liveResult;


        try {
          await conn.beginTransaction();


          // =========================================
          // 1. PUNKTY
          // =========================================

          [pointsResult] = await conn.query(
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


          // =========================================
          // 2. OFICJALNE WYNIKI MAP
          // =========================================

          [mapsResult] = await conn.query(
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


          // =========================================
          // 3. OFICJALNY WYNIK SERII
          // =========================================

          [seriesResult] = await conn.query(
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


          // =========================================
          // 4. LIVE SCORE / STATUS FINAL
          // =========================================
          //
          // To jest bardzo ważne.
          // Bez tego frontend może nadal pokazywać
          // stary wynik i status FINAL.

          [liveResult] = await conn.query(
            `
            DELETE FROM live_match_scores
            WHERE match_id = ?
            `,
            [
              match.id
            ]
          );


          await conn.commit();

        } catch (err) {

          await conn.rollback();
          throw err;

        } finally {

          conn.release();

        }


        // =========================================
        // WERYFIKACJA PO USUNIĘCIU
        // =========================================

        const [[checkSeries]] =
          await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM match_results
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


        const [[checkMaps]] =
          await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM match_map_results
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


        const [[checkPoints]] =
          await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM match_points
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


        const [[checkLive]] =
          await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM live_match_scores
            WHERE match_id = ?
            `,
            [
              match.id
            ]
          );


        const remaining =
          Number(checkSeries?.total || 0) +
          Number(checkMaps?.total || 0) +
          Number(checkPoints?.total || 0) +
          Number(checkLive?.total || 0);


        logInfo(
          'matches',
          'Match result reverted',
          {
            guildId,
            eventId: match.event_id,
            matchId: match.id,

            userId: interaction.user.id,

            teamA: match.team_a,
            teamB: match.team_b,

            oldResult,

            removedPointsRows:
              pointsResult?.affectedRows || 0,

            removedMapResults:
              mapsResult?.affectedRows || 0,

            removedSeriesResults:
              seriesResult?.affectedRows || 0,

            removedLiveScores:
              liveResult?.affectedRows || 0,

            remaining
          }
        );


        // =========================================
        // JEŚLI COŚ ZOSTAŁO
        // =========================================

        if (remaining > 0) {
          return interaction.editReply({
            content:
              `⚠️ **Wynik został cofnięty częściowo.**\n\n` +
              `🎮 **${match.team_a} ${oldResult} ${match.team_b}**\n\n` +

              `Pozostało w bazie:\n` +
              `• wynik serii: **${checkSeries.total}**\n` +
              `• wyniki map: **${checkMaps.total}**\n` +
              `• punkty: **${checkPoints.total}**\n` +
              `• live score: **${checkLive.total}**\n\n` +

              `Sprawdź log bota.`,
            embeds: [],
            components: []
          });
        }


        // =========================================
        // SUCCESS
        // =========================================

        return interaction.editReply({
          content:
            `✅ **Cofnięto wynik meczu**\n\n` +

            `🎮 **${match.team_a} ${oldResult} ${match.team_b}**\n\n` +

            `Usunięto:\n` +
            `↩️ wynik serii: **${seriesResult?.affectedRows || 0}**\n` +
            `🗺️ wyniki map: **${mapsResult?.affectedRows || 0}**\n` +
            `⭐ rekordy punktów: **${pointsResult?.affectedRows || 0}**\n` +
            `📡 live score: **${liveResult?.affectedRows || 0}**\n\n` +

            `✅ Typy użytkowników zostały zachowane.\n` +
            `✅ Stary status FINAL został wyczyszczony.\n\n` +

            `Możesz teraz ponownie wpisać poprawny wynik.`,
          embeds: [],
          components: []
        });
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
          '❌ Nie udało się cofnąć wyniku. Transakcja została wycofana.',
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