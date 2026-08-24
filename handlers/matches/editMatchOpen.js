const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');

const isAdmin = require('../../utils/isAdmin');
const { withGuild } = require('../../utils/guildContext');
const { logError } = require('../../utils/logger');

module.exports = async function editMatchOpen(interaction) {
  try {
    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: '❌ Brak uprawnień.',
        ephemeral: true
      });
    }

    if (
      !interaction.deferred &&
      !interaction.replied
    ) {
      await interaction.deferReply({
        ephemeral: true
      });
    }

    return withGuild(
      interaction,
      async ({ pool, guildId }) => {

        const [matches] = await pool.query(
          `
          SELECT
            m.id,
            m.event_id,
            m.phase,
            m.match_no,
            m.team_a,
            m.team_b,
            m.best_of,
            m.start_time_utc,

            CASE
              WHEN mr.match_id IS NOT NULL
              THEN 1
              ELSE 0
            END AS has_result

          FROM matches m

          LEFT JOIN match_results mr
            ON mr.guild_id = m.guild_id
           AND mr.event_id = m.event_id
           AND mr.match_id = m.id

          WHERE m.guild_id = ?

          ORDER BY
            m.event_id DESC,
            m.match_no ASC,
            m.id ASC

          LIMIT 25
          `,
          [guildId]
        );

        if (!matches.length) {
          return interaction.editReply({
            content:
              'ℹ️ Nie ma żadnych meczów do edycji.',
            embeds: [],
            components: []
          });
        }

        const options = matches.map(match => {
          const number = match.match_no
            ? `#${match.match_no}`
            : `ID ${match.id}`;

          const resultInfo =
            Number(match.has_result) === 1
              ? ' • ROZLICZONY'
              : '';

          return {
            label:
              `${match.team_a} vs ${match.team_b}`
                .slice(0, 100),

            description:
              `${number} • ${match.phase} • BO${match.best_of}${resultInfo}`
                .slice(0, 100),

            value:
              String(match.id),

            emoji:
              Number(match.has_result) === 1
                ? '🔒'
                : '✏️'
          };
        });

        const select =
          new StringSelectMenuBuilder()
            .setCustomId('edit_match_select')
            .setPlaceholder('Wybierz mecz do edycji')
            .addOptions(options);

        const embed =
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('✏️ Edycja meczu')
            .setDescription(
              'Wybierz mecz, który chcesz zmienić.\n\n' +
              '⚠️ W rozliczonym meczu nie będzie można zmienić drużyn ani BO.'
            );

        return interaction.editReply({
          content: '',
          embeds: [embed],
          components: [
            new ActionRowBuilder()
              .addComponents(select)
          ]
        });
      }
    );

  } catch (err) {
    logError(
      'matches',
      'editMatchOpen failed',
      {
        message: err.message,
        stack: err.stack
      }
    );

    return interaction.editReply({
      content:
        '❌ Nie udało się pobrać listy meczów.',
      embeds: [],
      components: []
    }).catch(() => {});
  }
};