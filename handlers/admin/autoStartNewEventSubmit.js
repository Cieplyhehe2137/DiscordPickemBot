const {
  withGuild
} = require('../../utils/guildContext');

const {
  makeSlug
} = require('../../utils/pickemAutoStart');

const {
  phaseMenu
} = require('./autoStartEventSelect');

module.exports =
  async function autoStartNewEventSubmit(interaction) {

    const eventName =
      interaction.fields
        .getTextInputValue(
          'event_name'
        )
        .trim();

    if (!eventName) {
      return interaction.reply({
        content:
          '❌ Podaj nazwę eventu.',
        ephemeral: true
      });
    }

    return withGuild(
      interaction.guildId,
      async ({
        pool,
        guildId
      }) => {

        const slug =
          makeSlug(eventName) ||
          `event-${Date.now()}`;

        const [existing] =
          await pool.query(
            `
            SELECT
              id,
              name,
              status,
              is_archived
            FROM events
            WHERE guild_id = ?
              AND slug = ?
            LIMIT 1
            `,
            [
              guildId,
              slug
            ]
          );

        let eventId;
        let finalName =
          eventName;

        if (existing.length) {
          if (
            existing[0].status ===
              'FINISHED' ||
            Number(
              existing[0]
                .is_archived
            ) === 1
          ) {
            return interaction.reply({
              content:
                '❌ Event o takiej nazwie istnieje już w archiwum. Użyj trochę innej nazwy.',
              ephemeral: true
            });
          }

          eventId =
            existing[0].id;

          finalName =
            existing[0].name;

        } else {

          const [result] =
            await pool.query(
              `
              INSERT INTO events
              (
                guild_id,
                slug,
                name,
                phase,
                status,
                is_open,
                is_active
              )
              VALUES (
                ?,
                ?,
                ?,
                'NOT_STARTED',
                'UPCOMING',
                0,
                1
              )
              `,
              [
                guildId,
                slug,
                eventName
              ]
            );

          eventId =
            result.insertId;
        }

        return interaction.reply({
          content:
            `✅ Event: **${finalName}**\n` +
            'Teraz wybierz fazę do automatycznego uruchomienia.',

          components: [
            phaseMenu(eventId)
          ],

          ephemeral: true
        });
      }
    );
  };