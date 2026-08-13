const {
  withGuild
} = require('../../utils/guildContext');

module.exports =
  async function autoStartCancelSelect(interaction) {

    const eventId =
      Number(
        interaction.values?.[0]
      );

    if (!eventId) {
      return interaction.reply({
        content:
          '❌ Niepoprawny event.',
        ephemeral: true
      });
    }

    return withGuild(
      interaction.guildId,
      async ({
        pool,
        guildId
      }) => {

        const [events] =
          await pool.query(
            `
            SELECT name
            FROM events
            WHERE id = ?
              AND guild_id = ?
            LIMIT 1
            `,
            [
              eventId,
              guildId
            ]
          );

        if (!events.length) {
          return interaction.update({
            content:
              '❌ Event nie istnieje.',
            components: []
          });
        }

        await pool.query(
          `
          UPDATE events
          SET
            auto_start_at = NULL,
            auto_start_phase = NULL,
            auto_start_channel_id = NULL,
            auto_started_at = NULL
          WHERE id = ?
            AND guild_id = ?
          `,
          [
            eventId,
            guildId
          ]
        );

        return interaction.update({
          content:
            `✅ Anulowano auto-start dla **${events[0].name}**.`,
          components: []
        });
      }
    );
  };