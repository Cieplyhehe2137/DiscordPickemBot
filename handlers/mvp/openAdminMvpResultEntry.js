const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const { withGuild } = require('../../utils/guildContext');
const { logError } = require('../../utils/logger');

const MVP_SELECT_LIMIT = 25;
const DISCORD_OPTION_LABEL_LIMIT = 100;

module.exports = async function openAdminMvpResultEntry(interaction) {
  try {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: '❌ Brak guildId.',
        ephemeral: true
      });
    }

    const candidates = await withGuild(interaction, async ({ pool, guildId }) => {
      const [rows] = await pool.query(
        `
        SELECT id, nickname, team_name
        FROM mvp_candidates
        WHERE guild_id = ?
          AND is_active = 1
        ORDER BY nickname ASC
        `,
        [guildId]
      );

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

    const visibleCandidates = candidates.slice(0, MVP_SELECT_LIMIT);
    const hiddenCount = Math.max(candidates.length - visibleCandidates.length, 0);

    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('🏆 Ustaw oficjalnego MVP')
      .setDescription(
        'Wybierz oficjalnego MVP turnieju.\n\n' +
        'Każdy user który trafi MVP dostanie **+5 pkt**.' +
        (
          hiddenCount > 0
            ? `\n\n⚠️ Pokazuję pierwszych **${MVP_SELECT_LIMIT}** z **${candidates.length}** kandydatów.`
            : ''
        )
      );

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('admin_mvp_result_select')
        .setPlaceholder('Wybierz MVP')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          visibleCandidates.map(c => {
            const nickname = String(c.nickname || 'Unknown');
            const teamName = c.team_name ? String(c.team_name) : null;

            return {
              label: (
                teamName
                  ? `${nickname} (${teamName})`
                  : nickname
              ).slice(0, DISCORD_OPTION_LABEL_LIMIT),
              value: String(c.id)
            };
          })
        )
    );

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  } catch (err) {
    logError('mvp', 'openAdminMvpResultEntry failed', {
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