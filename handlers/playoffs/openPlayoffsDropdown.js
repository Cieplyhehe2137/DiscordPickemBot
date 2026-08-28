const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");
const { logError } = require("../../utils/logger");

const {
  assertPredictionsAllowed,
  assertActivePredictionPanel,
} = require("../../utils/protectionsGuards");

const { getDraft, setDraft } = require("../../utils/predictionDraftCache");

const { getOpenEventId } = require("../../utils/getOpenEventId");
const { setMvpSession } = require("../../utils/mvpFlowSession");

const MVP_PAGE_SIZE = 25;

// ======================================================
// TEAMS
// ======================================================

async function loadTeamsFromDB(pool, guildId) {
  const [rows] = await pool.query(
    `
    SELECT name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY sort_order ASC, name ASC
    `,
    [guildId],
  );

  return rows.map((r) => r.name).filter(Boolean);
}

// ======================================================
// MVP
// ======================================================

async function loadMvpCandidates(pool, guildId) {
  const [rows] = await pool.query(
    `
    SELECT id, nickname, team_name
    FROM mvp_candidates
    WHERE guild_id = ?
      AND is_active = 1
    ORDER BY nickname ASC
    `,
    [guildId],
  );

  return rows;
}

function buildMvpRows(mvpCandidates, page = 0) {
  const totalPages = Math.ceil(mvpCandidates.length / MVP_PAGE_SIZE);

  const pageCandidates = mvpCandidates.slice(
    page * MVP_PAGE_SIZE,
    (page + 1) * MVP_PAGE_SIZE,
  );

  const mvpSelectRow = new ActionRowBuilder().addComponents(
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

  if (totalPages <= 1) {
    return [mvpSelectRow];
  }

  const mvpPaginationRow = new ActionRowBuilder().addComponents(
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

  return [mvpSelectRow, mvpPaginationRow];
}

// ======================================================
// HANDLER
// ======================================================

module.exports = async function openPlayoffsDropdown(interaction) {
  try {
    // ==================================================
    // GUILD
    // ==================================================

    if (!interaction.guildId) {
      return interaction.reply({
        content: "❌ Brak guildId.",
        ephemeral: true,
      });
    }

    // ==================================================
    // DEFER
    // ==================================================

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({
        ephemeral: true,
      });
    }

    // ==================================================
    // GUILD CONTEXT
    // ==================================================

    return withGuild(interaction, async ({ pool, guildId }) => {
      // ================================================
      // ACTIVE PANEL GUARD
      // ================================================
      //
      // Sprawdza message_id publicznego panelu.
      // Dzięki temu panel poprzedniego eventu nie
      // otworzy formularza nawet wtedy, gdy nowy event
      // również znajduje się w fazie Playoffs.
      // ================================================

      const panelGate = await assertActivePredictionPanel({
        pool,
        guildId,
        messageId: interaction.message?.id,
        phase: "playoffs",
      });

      if (!panelGate.allowed) {
        return interaction.editReply({
          content: panelGate.message,
          embeds: [],
          components: [],
        });
      }

      // ================================================
      // PHASE GUARD
      // ================================================

      const gate = await assertPredictionsAllowed({
        guildId,
        kind: "PLAYOFFS",
      });

      if (!gate.allowed) {
        return interaction.editReply({
          content:
            gate.message ||
            "❌ Typowanie fazy Playoffs jest aktualnie niedostępne.",
          embeds: [],
          components: [],
        });
      }

      // ================================================
      // CURRENT EVENT
      // ================================================

      const eventId = await getOpenEventId(pool, guildId);

      if (!eventId) {
        return interaction.editReply({
          content: "❌ Nie znaleziono aktywnego eventu.",
          embeds: [],
          components: [],
        });
      }

      // ================================================
      // EVENT-BOUND DRAFT
      // ================================================
      //
      // Draft zostaje przypisany do konkretnego eventu.
      //
      // Jeśli gracz ponownie otworzy panel tego samego
      // eventu, nie resetujemy jego dotychczasowych
      // wyborów.
      //
      // Jeśli rozpoczął się inny event, stary draft
      // zostaje zastąpiony nowym.
      // ================================================

      const draftKey = `${guildId}:${interaction.user.id}`;

      const existingDraft = getDraft("playoffs", draftKey);

      if (!existingDraft || Number(existingDraft.eventId) !== Number(eventId)) {
        setDraft("playoffs", draftKey, {
          eventId,
        });
      }

      // ==================================================
      // MVP FLOW SESSION
      // ==================================================

      setMvpSession(guildId, interaction.user.id, eventId);

      // ================================================
      // TEAMS
      // ================================================

      const teams = await loadTeamsFromDB(pool, guildId);

      if (!teams.length) {
        return interaction.editReply({
          content: "❌ Brak drużyn w bazie.",
          embeds: [],
          components: [],
        });
      }

      if (teams.length > 25) {
        return interaction.editReply({
          content:
            `⚠️ Jest **${teams.length} drużyn**, ` +
            "a Discord pozwala na maksymalnie " +
            "**25 opcji** w jednym dropdownie.",
          embeds: [],
          components: [],
        });
      }

      // ================================================
      // MVP
      // ================================================

      const mvpCandidates = await loadMvpCandidates(pool, guildId);

      // ================================================
      // EMBED
      // ================================================

      const embed = new EmbedBuilder()
        .setColor("#f1c40f")
        .setTitle("📌 Pick'Em – Playoffs")
        .setDescription(
          "Wybierz drużyny dla fazy play-off:\n\n" +
            "🏅 4 półfinalistów\n" +
            "🥈 2 finalistów\n" +
            "🥇 1 zwycięzcę\n" +
            "🥉 (opcjonalnie) 1 drużynę na 3. miejscu\n" +
            (mvpCandidates.length ? "⭐ 1 MVP turnieju\n" : ""),
        );

      // ================================================
      // OPTIONS
      // ================================================

      const makeOptions = () =>
        teams.map((team) => ({
          label: team,
          value: team,
        }));

      // ================================================
      // SEMIFINALISTS
      // ================================================

      const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("playoffs_semifinalists")
          .setPlaceholder("Wybierz 4 półfinalistów")
          .setMinValues(4)
          .setMaxValues(4)
          .addOptions(makeOptions()),
      );

      // ================================================
      // FINALISTS
      // ================================================

      const row2 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("playoffs_finalists")
          .setPlaceholder("Wybierz 2 finalistów")
          .setMinValues(2)
          .setMaxValues(2)
          .addOptions(makeOptions()),
      );

      // ================================================
      // WINNER
      // ================================================

      const row3 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("playoffs_winner")
          .setPlaceholder("Wybierz zwycięzcę")
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(makeOptions()),
      );

      // ================================================
      // THIRD PLACE
      // ================================================

      const row4 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("playoffs_third_place")
          .setPlaceholder("(Opcjonalnie) Wybierz 3. miejsce")
          .setMinValues(0)
          .setMaxValues(1)
          .addOptions(makeOptions()),
      );

      // ================================================
      // MAIN RESPONSE
      // ================================================

      await interaction.editReply({
        embeds: [embed],
        components: [row1, row2, row3, row4],
      });

      // ================================================
      // MVP RESPONSE
      // ================================================

      if (mvpCandidates.length) {
        await interaction.followUp({
          content: "⭐ Wybierz MVP turnieju:",
          components: buildMvpRows(mvpCandidates, 0),
          ephemeral: true,
        });
      }

      // ================================================
      // CONFIRM
      // ================================================

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_playoffs")
          .setLabel("✅ Zatwierdź typy")
          .setStyle(ButtonStyle.Success),
      );

      return interaction.followUp({
        content: "Gdy skończysz wybierać wszystkie typy, kliknij poniżej:",
        components: [confirmRow],
        ephemeral: true,
      });
    });
  } catch (err) {
    logError("playoffs", "openPlayoffsDropdown failed", {
      guildId: interaction.guildId,
      message: err?.message,
      stack: err?.stack,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction
        .editReply({
          content: "❌ Błąd otwierania Pick'Em Playoffs.",
          embeds: [],
          components: [],
        })
        .catch(() => {});
    }

    return interaction
      .reply({
        content: "❌ Błąd otwierania Pick'Em Playoffs.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
