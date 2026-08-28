const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");
const { logError } = require("../../utils/logger");

const { assertPredictionsAllowed } = require("../../utils/protectionsGuards");

const { validateMvpSession } = require("../../utils/mvpFlowSession");

const { getOpenEventId } = require("../../utils/getOpenEventId");

const { getActiveMvpCandidates } = require("../../utils/mvpRepository");

const MVP_PAGE_SIZE = 25;

// ======================================================
// HANDLER
// ======================================================

module.exports = async function playoffsMvpPagination(interaction) {
  try {
    // ==================================================
    // INTERACTION
    // ==================================================

    if (!interaction.isButton()) return;

    if (
      !interaction.customId.startsWith("playoffs_mvp_prev_") &&
      !interaction.customId.startsWith("playoffs_mvp_next_")
    ) {
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user?.id;

    if (!guildId || !userId) {
      return interaction.deferUpdate().catch(() => {});
    }

    // ==================================================
    // PAGE
    // ==================================================

    const isPrev = interaction.customId.startsWith("playoffs_mvp_prev_");

    const currentPage = Number(interaction.customId.split("_").pop());

    if (!Number.isInteger(currentPage) || currentPage < 0) {
      return interaction.deferUpdate().catch(() => {});
    }

    // ==================================================
    // DEFER
    // ==================================================

    await interaction.deferUpdate();

    // ==================================================
    // GUILD CONTEXT
    // ==================================================

    return withGuild(interaction, async ({ pool, guildId }) => {
      // ==============================================
      // PHASE GUARD
      // ==============================================

      const gate = await assertPredictionsAllowed({
        guildId,
        kind: "PLAYOFFS",
      });

      if (!gate.allowed) {
        return interaction.followUp({
          content:
            gate.message || "❌ Typowanie MVP nie jest obecnie dostępne.",
          ephemeral: true,
        });
      }

      // ==============================================
      // CURRENT EVENT
      // ==============================================

      const currentEventId = await getOpenEventId(pool, guildId);

      if (!currentEventId) {
        return interaction.followUp({
          content: "❌ Nie znaleziono aktywnego eventu.",
          ephemeral: true,
        });
      }

      // ==============================================
      // MVP FLOW SESSION
      // ==============================================

      const sessionGate = validateMvpSession({
        guildId,
        userId,
        eventId: currentEventId,
      });

      if (!sessionGate.allowed) {
        return interaction.followUp({
          content:
            sessionGate.message ||
            "❌ Ten formularz MVP nie jest już aktualny.",
          ephemeral: true,
        });
      }

      // ==============================================
      // CANDIDATES
      // ==============================================

      const rows = await getActiveMvpCandidates(pool, guildId);

      if (!rows.length) {
        return interaction.followUp({
          content: "❌ Brak aktywnych kandydatów MVP.",
          ephemeral: true,
        });
      }

      // ==============================================
      // PAGINATION
      // ==============================================

      const totalPages = Math.ceil(rows.length / MVP_PAGE_SIZE);

      let page = isPrev ? currentPage - 1 : currentPage + 1;

      page = Math.max(0, Math.min(page, totalPages - 1));

      const startIndex = page * MVP_PAGE_SIZE;

      const endIndex = startIndex + MVP_PAGE_SIZE;

      const pageCandidates = rows.slice(startIndex, endIndex);

      if (!pageCandidates.length) {
        return interaction.followUp({
          content: "❌ Nie znaleziono kandydatów MVP na tej stronie.",
          ephemeral: true,
        });
      }

      // ==============================================
      // MENU
      // ==============================================

      const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`playoffs_mvp_page_${page}`)
          .setPlaceholder(`⭐ Wybierz MVP turnieju (${page + 1}/${totalPages})`)
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            pageCandidates.map((candidate) => ({
              label: candidate.team_name
                ? `${candidate.nickname} (${candidate.team_name})`
                : candidate.nickname,

              value: String(candidate.id),
            })),
          ),
      );

      // ==============================================
      // PAGINATION BUTTONS
      // ==============================================

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`playoffs_mvp_prev_${page}`)
          .setLabel("◀ MVP")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId(`playoffs_mvp_next_${page}`)
          .setLabel("MVP ▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      );

      // ==============================================
      // PRESERVE OTHER COMPONENTS
      // ==============================================

      const oldComponents = interaction.message?.components || [];

      const newComponents = [];

      for (const row of oldComponents) {
        const hasMvpMenu = row.components?.some(
          (component) =>
            component.customId &&
            component.customId.startsWith("playoffs_mvp_page_"),
        );

        const hasMvpButtons = row.components?.some(
          (component) =>
            component.customId &&
            (component.customId.startsWith("playoffs_mvp_prev_") ||
              component.customId.startsWith("playoffs_mvp_next_")),
        );

        if (!hasMvpMenu && !hasMvpButtons) {
          newComponents.push(row);
        }
      }

      // ==============================================
      // NEW MVP COMPONENTS
      // ==============================================

      newComponents.push(menuRow);

      if (totalPages > 1) {
        newComponents.push(buttonsRow);
      }

      // ==============================================
      // UPDATE MESSAGE
      // ==============================================

      return interaction.editReply({
        components: newComponents,
      });
    });
  } catch (err) {
    // ==================================================
    // ERROR
    // ==================================================

    logError("mvp", "playoffsMvpPagination failed", {
      guildId: interaction.guildId,
      message: err?.message,
      stack: err?.stack,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction
        .followUp({
          content: "❌ Nie udało się zmienić strony MVP.",
          ephemeral: true,
        })
        .catch(() => {});
    }

    return interaction
      .reply({
        content: "❌ Nie udało się zmienić strony MVP.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
