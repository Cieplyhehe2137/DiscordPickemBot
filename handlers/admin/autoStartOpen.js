const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const {
  withGuild
} = require('../../utils/guildContext');

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );
}

module.exports = async function autoStartOpen(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: '⛔ Tylko administracja.',
      ephemeral: true
    });
  }

  return withGuild(
    interaction.guildId,
    async ({ pool, guildId }) => {
      const [events] = await pool.query(
        `
        SELECT
          id,
          name,
          status,
          auto_start_at,
          auto_start_phase
        FROM events
        WHERE guild_id = ?
          AND is_archived = 0
          AND status <> 'FINISHED'
        ORDER BY id DESC
        LIMIT 24
        `,
        [guildId]
      );

      const options = [
        {
          label: '➕ Nowy event',
          description:
            'Utwórz event i zaplanuj jego automatyczny start',
          value: 'new'
        },

        ...events.map(event => ({
          label: String(event.name).slice(0, 100),

          description:
            event.auto_start_at
              ? `Zaplanowany: ${event.auto_start_phase || '?'} — wybierz, aby zmienić`
              : `Status: ${event.status}`,

          value: String(event.id)
        }))
      ];

      const select =
        new StringSelectMenuBuilder()
          .setCustomId(
            'auto_start:event_select'
          )
          .setPlaceholder(
            'Wybierz event'
          )
          .addOptions(options);

      const components = [
        new ActionRowBuilder()
          .addComponents(select)
      ];

      const [scheduled] =
        await pool.query(
          `
          SELECT id
          FROM events
          WHERE guild_id = ?
            AND auto_start_at IS NOT NULL
            AND auto_started_at IS NULL
            AND status <> 'FINISHED'
          LIMIT 1
          `,
          [guildId]
        );

      if (scheduled.length) {
        components.push(
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  'auto_start:cancel_open'
                )
                .setLabel(
                  '🗑️ Anuluj zaplanowany start'
                )
                .setStyle(
                  ButtonStyle.Danger
                )
            )
        );
      }

      return interaction.reply({
        content:
          '🕒 **Auto-start Pick’Em**\n' +
          'Wybierz istniejący event albo utwórz nowy.',
        components,
        ephemeral: true
      });
    }
  );
};