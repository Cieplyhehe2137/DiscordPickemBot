const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');
const { logError } = require('../utils/logger');

const MVP_PAGE_SIZE = 25;

module.exports = async function playoffsMvpPagination(interaction) {
  try {
    if (!interaction.isButton()) return;

    if (
      !interaction.customId.startsWith('playoffs_mvp_prev_') &&
      !interaction.customId.startsWith('playoffs_mvp_next_')
    ) {
      return;
    }

    const isPrev = interaction.customId.startsWith('playoffs_mvp_prev_');

    const currentPage = Number(
      interaction.customId.split('_').pop()
    );

    await withGuild(interaction, async ({ pool, guildId }) => {
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

      const totalPages = Math.ceil(rows.length / MVP_PAGE_SIZE);

      let page = isPrev
        ? currentPage - 1
        : currentPage + 1;

      page = Math.max(0, Math.min(page, totalPages - 1));

      const pageCandidates = rows.slice(
        page * MVP_PAGE_SIZE,
        (page + 1) * MVP_PAGE_SIZE
      );

      const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`playoffs_mvp_page_${page}`)
          .setPlaceholder(
            `⭐ Wybierz MVP turnieju (${page + 1}/${totalPages})`
          )
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            pageCandidates.map(c => ({
              label: c.team_name
                ? `${c.nickname} (${c.team_name})`
                : c.nickname,
              value: String(c.id)
            }))
          )
      );

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`playoffs_mvp_prev_${page}`)
          .setLabel('◀ MVP')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId(`playoffs_mvp_next_${page}`)
          .setLabel('MVP ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );

      const oldComponents = interaction.message.components;

      const newComponents = [];

      for (const row of oldComponents) {
        const hasMvpMenu = row.components.some(
          c =>
            c.customId &&
            c.customId.startsWith('playoffs_mvp_page_')
        );

        const hasMvpButtons = row.components.some(
          c =>
            c.customId &&
            (
              c.customId.startsWith('playoffs_mvp_prev_') ||
              c.customId.startsWith('playoffs_mvp_next_')
            )
        );

        if (!hasMvpMenu && !hasMvpButtons) {
          newComponents.push(row);
        }
      }

      newComponents.push(menuRow);

      if (totalPages > 1) {
        newComponents.push(buttonsRow);
      }

      await interaction.update({
        components: newComponents
      });
    });
  } catch (err) {
    logError('mvp', 'playoffsMvpPagination failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.deferUpdate().catch(() => {});
  }
};