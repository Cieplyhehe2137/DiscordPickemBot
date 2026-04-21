const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');

module.exports = async function openAdminMvpResultEntry(interaction) {
  try {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: '❌ Brak guildId.',
        ephemeral: true
      });
    }

    // pobranie aktywnego eventu
    const eventId = await withGuild({ guildId }, async ({ pool }) => {

      const [rows] = await pool.query(`
        SELECT id
        FROM events
        WHERE guild_id = ?
        ORDER BY id DESC
        LIMIT 1
      `, [guildId]);

      return rows[0]?.id || null;
    });

    if (!eventId) {
      return interaction.reply({
        content: '❌ Nie znaleziono eventu.',
        ephemeral: true
      });
    }

    // pobranie kandydatów MVP
    const candidates = await withGuild({ guildId }, async ({ pool }) => {

      const [rows] = await pool.query(`
        SELECT id, nickname, team_name
        FROM mvp_candidates
        WHERE guild_id = ?
        AND event_id = ?
        AND is_active = 1
        ORDER BY nickname ASC
      `, [guildId, eventId]);

      return rows;
    });

    if (!candidates.length) {
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
        'Wybierz oficjalnego MVP turnieju.\n\n' +
        'Każdy user który trafi MVP dostanie **+5 pkt**.'
      );

    const row = new ActionRowBuilder().addComponents(

      new StringSelectMenuBuilder()
        .setCustomId(`admin_mvp_result_select:${eventId}`)
        .setPlaceholder('Wybierz MVP')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(

          candidates.map(c => ({
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

  } catch (err) {

    logger.error('mvp', 'openAdminMvpResultEntry failed', {
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