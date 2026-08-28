const { withGuild } = require("../../utils/guildContext");
const { logInfo, logError } = require("../../utils/logger");

module.exports = async function autoStartCancelSelect(interaction) {
  const eventId = Number(interaction.values?.[0]);

  if (!eventId) {
    return interaction.reply({
      content: "❌ Niepoprawny event.",
      ephemeral: true,
    });
  }

  return withGuild(interaction.guildId, async ({ pool, guildId }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [events] = await connection.query(
        `
        SELECT
          id,
          name,
          status,
          is_open,
          is_active,
          is_archived,
          auto_start_at,
          auto_started_at
        FROM events
        WHERE id = ?
          AND guild_id = ?
        FOR UPDATE
        `,
        [eventId, guildId],
      );

      const event = events[0];

      if (!event) {
        await connection.rollback();

        return interaction.update({
          content: "❌ Event nie istnieje.",
          components: [],
        });
      }

      // Anulować można wyłącznie oczekujący auto-start.
      // Aktywnego, zakończonego lub archiwalnego eventu
      // ten handler nie może już modyfikować.
      const canCancel =
        event.status === "UPCOMING" &&
        Number(event.is_open) === 0 &&
        Number(event.is_active) === 0 &&
        Number(event.is_archived) === 0 &&
        event.auto_start_at &&
        !event.auto_started_at;

      if (!canCancel) {
        await connection.rollback();

        return interaction.update({
          content:
            "❌ Tego auto-startu nie można już anulować. " +
            "Event mógł zostać uruchomiony, zakończony albo harmonogram został już usunięty.",
          components: [],
        });
      }

      const [result] = await connection.query(
        `
        UPDATE events
        SET
          auto_start_at = NULL,
          auto_start_phase = NULL,
          auto_start_channel_id = NULL,
          auto_started_at = NULL
        WHERE id = ?
          AND guild_id = ?
          AND status = 'UPCOMING'
          AND is_open = 0
          AND is_active = 0
          AND COALESCE(is_archived, 0) = 0
          AND auto_start_at IS NOT NULL
          AND auto_started_at IS NULL
        `,
        [eventId, guildId],
      );

      if (result.affectedRows !== 1) {
        throw new Error(
          `Nie udało się anulować auto-startu eventu ${eventId}.`,
        );
      }

      await connection.commit();

      logInfo("PickEm auto-start cancelled", {
        guildId,
        eventId,
        eventName: event.name,
        by: interaction.user?.id,
      });

      return interaction.update({
        content: `✅ Anulowano auto-start dla **${event.name}**.`,
        components: [],
      });
    } catch (err) {
      try {
        await connection.rollback();
      } catch {}

      logError("PickEm auto-start cancellation failed", err, {
        guildId,
        eventId,
        userId: interaction.user?.id,
      });

      return interaction
        .update({
          content: "❌ Nie udało się anulować auto-startu.",
          components: [],
        })
        .catch(() => {});
    } finally {
      connection.release();
    }
  });
};
