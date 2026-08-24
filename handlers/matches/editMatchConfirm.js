const isAdmin =
  require('../../utils/isAdmin');

const {
  withGuild
} = require('../../utils/guildContext');

const {
  logInfo,
  logError
} = require('../../utils/logger');


module.exports =
async function editMatchConfirm(
  interaction
) {

  if (
    !String(
      interaction.customId || ''
    ).startsWith(
      'edit_match_confirm:'
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


  const editId =
    Number(
      interaction.customId
        .split(':')[1]
    );


  if (!editId) {
    return interaction.reply({
      content:
        '❌ Nieprawidłowa edycja.',
      ephemeral: true
    });
  }


  try {

    await interaction.deferUpdate();


    return withGuild(
      interaction,

      async ({
        pool,
        guildId
      }) => {


        // =========================================
        // PENDING EDIT
        // =========================================

        const [[edit]] =
          await pool.query(
            `
            SELECT *
            FROM pending_match_edits

            WHERE id = ?
              AND guild_id = ?
              AND user_id = ?

            LIMIT 1
            `,
            [
              editId,
              guildId,
              interaction.user.id
            ]
          );


        if (!edit) {
          return interaction.editReply({
            content:
              '❌ Ta edycja wygasła albo została już wykorzystana.',
            embeds: [],
            components: []
          });
        }


        // =========================================
        // MECZ NADAL ISTNIEJE?
        // =========================================

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
              edit.match_id
            ]
          );


        if (!match) {
          return interaction.editReply({
            content:
              '❌ Mecz już nie istnieje.',
            embeds: [],
            components: []
          });
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
            edit.team_a,
            edit.team_b,
            edit.best_of,
            edit.match_no,
            edit.start_time_utc,

            guildId,
            edit.match_id
          ]
        );


        // =========================================
        // USUWAMY PENDING
        // =========================================

        await pool.query(
          `
          DELETE FROM pending_match_edits
          WHERE id = ?
          `,
          [editId]
        );


        logInfo(
          'matches',
          'Match edit confirmed',
          {
            guildId,

            eventId:
              match.event_id,

            matchId:
              match.id,

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
              teamA:
                edit.team_a,

              teamB:
                edit.team_b,

              bestOf:
                edit.best_of,

              matchNo:
                edit.match_no,

              startTime:
                edit.start_time_utc
            }
          }
        );


        return interaction.editReply({
          content:
            `✅ **Zmiany zostały zapisane.**\n\n` +

            `🎮 **${edit.team_a} vs ${edit.team_b}**\n` +
            `📋 BO: **${edit.best_of}**\n` +
            `🔢 Numer: **${edit.match_no ?? 'brak'}**\n` +
            `🕒 Start: **${edit.start_time_utc || 'brak'} UTC**`,

          embeds: [],
          components: []
        });
      }
    );


  } catch (err) {

    logError(
      'matches',
      'editMatchConfirm failed',
      {
        message:
          err.message,

        stack:
          err.stack,

        editId
      }
    );


    if (
      interaction.deferred ||
      interaction.replied
    ) {
      return interaction.editReply({
        content:
          '❌ Nie udało się zapisać zmian.',
        embeds: [],
        components: []
      }).catch(() => {});
    }
  }
};