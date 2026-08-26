const isAdmin = require("../../utils/isAdmin");

const { withGuild } = require("../../utils/guildContext");

const { logInfo, logError } = require("../../utils/logger");

function getEditId(interaction) {
  return Number(String(interaction.customId || "").split(":")[1]);
}

function buildSuccessMessage(edit) {
  return (
    `✅ **Zmiany zostały zapisane.**\n\n` +
    `🎮 **${edit.team_a} vs ${edit.team_b}**\n` +
    `📋 Faza: **${edit.phase || "brak"}**\n` +
    `📋 BO: **${edit.best_of}**\n` +
    `🔢 Numer: **${edit.match_no ?? "brak"}**\n` +
    `🕒 Start: **${edit.start_time_utc || "brak"} UTC**`
  );
}

module.exports = async function editMatchConfirm(interaction) {
  if (!String(interaction.customId || "").startsWith("edit_match_confirm:")) {
    return;
  }

  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "❌ Brak uprawnień.",
      ephemeral: true,
    });
  }

  const editId = getEditId(interaction);

  if (!editId) {
    return interaction.reply({
      content: "❌ Nieprawidłowa edycja.",
      ephemeral: true,
    });
  }

  try {
    await interaction.deferUpdate();

    return withGuild(interaction, async ({ pool, guildId }) => {
      // ==================================================
      // CLEANUP STARYCH PENDINGÓW
      // ==================================================

      await pool.query(
        `
            DELETE FROM pending_match_edits
            WHERE created_at < DATE_SUB(
              NOW(),
              INTERVAL 1 HOUR
            )
            `,
      );

      // ==================================================
      // PENDING EDIT
      // ==================================================

      const [[edit]] = await pool.query(
        `
              SELECT *
              FROM pending_match_edits
              WHERE id = ?
                AND guild_id = ?
                AND user_id = ?
                AND created_at >= DATE_SUB(
                  NOW(),
                  INTERVAL 1 HOUR
                )
              LIMIT 1
              `,
        [editId, guildId, interaction.user.id],
      );

      if (!edit) {
        return interaction.editReply({
          content: "❌ Ta edycja wygasła albo została już wykorzystana.",
          embeds: [],
          components: [],
        });
      }

      // ==================================================
      // MECZ NADAL ISTNIEJE?
      // ==================================================

      const [[match]] = await pool.query(
        `
              SELECT
                id,
                event_id,
                phase,
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
        [guildId, edit.match_id],
      );

      if (!match) {
        await pool.query(
          `
              DELETE FROM pending_match_edits
              WHERE id = ?
                AND guild_id = ?
              `,
          [editId, guildId],
        );

        return interaction.editReply({
          content: "❌ Mecz już nie istnieje.",
          embeds: [],
          components: [],
        });
      }

      // ==================================================
      // UPDATE MECZU
      // ==================================================

      await pool.query(
        `
            UPDATE matches
            SET
              phase = ?,
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
          edit.phase,
          edit.team_a,
          edit.team_b,
          edit.best_of,
          edit.match_no,
          edit.start_time_utc,
          guildId,
          edit.match_id,
        ],
      );

      // ==================================================
      // USUWAMY PENDING EDIT
      // ==================================================

      await pool.query(
        `
            DELETE FROM pending_match_edits
            WHERE id = ?
              AND guild_id = ?
              AND user_id = ?
            `,
        [editId, guildId, interaction.user.id],
      );

      // ==================================================
      // LOG
      // ==================================================

      logInfo("matches", "Match edit confirmed", {
        guildId,

        eventId: match.event_id,

        matchId: match.id,

        userId: interaction.user.id,

        before: {
          phase: match.phase,

          teamA: match.team_a,

          teamB: match.team_b,

          bestOf: match.best_of,

          matchNo: match.match_no,

          startTime: match.start_time_utc,
        },

        after: {
          phase: edit.phase,

          teamA: edit.team_a,

          teamB: edit.team_b,

          bestOf: edit.best_of,

          matchNo: edit.match_no,

          startTime: edit.start_time_utc,
        },
      });

      // ==================================================
      // SUCCESS
      // ==================================================

      return interaction.editReply({
        content: buildSuccessMessage(edit),

        embeds: [],
        components: [],
      });
    });
  } catch (err) {
    logError("matches", "editMatchConfirm failed", {
      message: err.message,

      stack: err.stack,

      editId,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction
        .editReply({
          content: "❌ Nie udało się zapisać zmian.",
          embeds: [],
          components: [],
        })
        .catch(() => {});
    }

    return interaction
      .reply({
        content: "❌ Nie udało się zapisać zmian.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
