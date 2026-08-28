const { withGuild } = require("../../utils/guildContext");

const { parseAutoStartInput } = require("../../utils/pickemAutoStart");

const { phasesConfig } = require("../../utils/pickemPanelPublisher");

const { logInfo, logError } = require("../../utils/logger");

module.exports = async function autoStartScheduleSubmit(interaction) {
  try {
    const [, , eventIdRaw, phase, channelId] = interaction.customId.split(":");

    const eventId = Number(eventIdRaw);

    const raw = interaction.fields.getTextInputValue("start_at");

    const parsed = parseAutoStartInput(raw);

    if (!eventId || !phasesConfig[phase] || !channelId) {
      return interaction.reply({
        content: "❌ Niepoprawne dane auto-startu.",
        ephemeral: true,
      });
    }

    if (!parsed.ok) {
      return interaction.reply({
        content: `❌ ${parsed.error}`,
        ephemeral: true,
      });
    }

    return withGuild(interaction.guildId, async ({ pool, guildId }) => {
      const [events] = await pool.query(
        `
        SELECT
          id,
          name,
          status,
          is_open,
          is_active,
          is_archived
        FROM events
        WHERE id = ?
          AND guild_id = ?
        LIMIT 1
        `,
        [eventId, guildId],
      );

      const event = events[0];

      if (!event) {
        return interaction.reply({
          content: "❌ Event nie istnieje.",
          ephemeral: true,
        });
      }

      if (
        event.status === "FINISHED" ||
        event.status === "ARCHIVED" ||
        Number(event.is_archived) === 1
      ) {
        return interaction.reply({
          content:
            "❌ Nie można zaplanować startu dla zakończonego/archiwalnego eventu.",
          ephemeral: true,
        });
      }

      // ==================================================
      // LIFECYCLE
      // ==================================================
      //
      // Zaplanowanie auto-startu NIE aktywuje eventu.
      //
      // Jeżeli event nie jest aktualnie aktywnym eventem:
      //
      // status    = UPCOMING
      // is_open   = 0
      // is_active = 0
      //
      // Jeżeli z jakiegoś powodu planujemy auto-start
      // dla już aktywnego eventu, nie zamykamy go tutaj.
      // ==================================================

      const isCurrentlyActive =
        event.status === "OPEN" &&
        Number(event.is_open) === 1 &&
        Number(event.is_active) === 1;

      if (isCurrentlyActive) {
        await pool.query(
          `
          UPDATE events
          SET
            auto_start_at = ?,
            auto_start_phase = ?,
            auto_start_channel_id = ?,
            auto_started_at = NULL
          WHERE id = ?
            AND guild_id = ?
          `,
          [parsed.utcSql, phase, channelId, eventId, guildId],
        );
      } else {
        await pool.query(
          `
          UPDATE events
          SET
            status = 'UPCOMING',
            is_open = 0,
            is_active = 0,
            auto_start_at = ?,
            auto_start_phase = ?,
            auto_start_channel_id = ?,
            auto_started_at = NULL
          WHERE id = ?
            AND guild_id = ?
          `,
          [parsed.utcSql, phase, channelId, eventId, guildId],
        );
      }

      const unix = Math.floor(parsed.utc.toSeconds());

      logInfo("Auto-start scheduled", {
        guildId,
        eventId,
        phase,
        channelId,
        startAtUtc: parsed.utc.toISO(),
        by: interaction.user?.id,
      });

      return interaction.reply({
        content:
          "✅ **Zaplanowano auto-start Pick’Em**\n" +
          `🏆 Event: **${event.name}**\n` +
          `🎮 Faza: **${phasesConfig[phase].label}**\n` +
          `📢 Kanał: <#${channelId}>\n` +
          `🕒 Start: <t:${unix}:F>\n` +
          `⏳ <t:${unix}:R>`,

        ephemeral: true,
      });
    });
  } catch (err) {
    logError("Auto-start scheduling failed", err, {
      guildId: interaction.guildId,
    });

    return interaction
      .reply({
        content: "❌ Nie udało się zaplanować auto-startu.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
