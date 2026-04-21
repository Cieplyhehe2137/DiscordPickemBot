const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');

module.exports = async function openAdminMvpResult(interaction, eventId) {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Brak guildId.',
        ephemeral: true
      });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const [rows] = await pool.query(
        `
          SELECT id, nickname, team_name
          FROM mvp_candidates
          WHERE guild_id = ?
            AND event_id = ?
            AND is_active = 1
          ORDER BY nickname ASC
        `,
        [guildId, eventId]
      );

      if (!rows.length) {
        return interaction.reply({
          content:
            '❌ Brak kandydatów MVP.\n' +
            'Najpierw dodaj kandydatów w panelu MVP.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('🏆 Ustaw oficjalnego MVP')
        .setDescription(
          'Wybierz gracza, który został oficjalnym MVP turnieju.\n\n' +
          'Każdy użytkownik, który go wytypował, dostanie **+5 pkt**.'
        );

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`admin_mvp_result_select:${eventId}`)
          .setPlaceholder('Wybierz oficjalnego MVP')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            rows.map(c => ({
              label: c.team_name
                ? `${c.nickname} (${c.team_name})`
                : c.nickname,
              value: String(c.id)
            }))
          )
      );

      return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
    });
  } catch (err) {
    logger.error('mvp', 'openAdminMvpResult failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.reply({
      content: '❌ Nie udało się otworzyć wyboru MVP.',
      ephemeral: true
    }).catch(() => {});
  }
};