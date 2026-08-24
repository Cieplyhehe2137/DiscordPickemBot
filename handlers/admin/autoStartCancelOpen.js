const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

const { withGuild } = require("../../utils/guildContext");

const { DateTime } = require("luxon");

module.exports = async function autoStartCancelOpen(interaction) {
  return withGuild(interaction.guildId, async ({ pool, guildId }) => {
    const [events] = await pool.query(
      `
            SELECT
              id,
              name,
              auto_start_at,
              auto_start_phase
            FROM events
            WHERE guild_id = ?
              AND auto_start_at IS NOT NULL
              AND auto_started_at IS NULL
              AND status <> 'FINISHED'
            ORDER BY auto_start_at ASC
            LIMIT 25
            `,
      [guildId],
    );

    if (!events.length) {
      return interaction.reply({
        content: "ℹ️ Nie ma żadnego zaplanowanego auto-startu.",
        ephemeral: true,
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("auto_start:cancel_select")
      .setPlaceholder("Wybierz auto-start do anulowania")
      .addOptions(
        events.map((event) => {
          const local = DateTime.fromJSDate(new Date(event.auto_start_at), {
            zone: "utc",
          })
            .setZone("Europe/Warsaw")
            .toFormat("dd.LL HH:mm");

          return {
            label: String(event.name).slice(0, 100),

            description: `${event.auto_start_phase || "?"} — ${local}`.slice(
              0,
              100,
            ),

            value: String(event.id),
          };
        }),
      );

    return interaction.reply({
      content: "🗑️ Wybierz zaplanowany start, który chcesz anulować.",

      components: [new ActionRowBuilder().addComponents(menu)],

      ephemeral: true,
    });
  });
};
