const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");
const { logError } = require("../../utils/logger");

const {
  assertPredictionsAllowed,
  assertActivePredictionPanel,
} = require("../../utils/protectionsGuards");

const { getDraft, setDraft } = require("../../utils/predictionDraftCache");

const { getOpenEventId } = require("../../utils/getOpenEventId");

// ======================================================
// CONSTANTS
// ======================================================

const NAMESPACE = "swiss";

const VALID_STAGES = new Set(["stage1", "stage2", "stage3"]);

// ======================================================
// TEAMS
// ======================================================

async function loadTeamsWithFlags(pool, guildId) {
  const [rows] = await pool.query(
    `
    SELECT
      name,
      flag
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY sort_order ASC, name ASC
    `,
    [guildId],
  );

  return rows
    .filter((row) => row.name)
    .map((row) => ({
      name: row.name,
      label: `${row.flag || ""} ${row.name}`.trim(),
    }));
}

// ======================================================
// HANDLER
// ======================================================

module.exports = async (interaction) => {
  try {
    // ==================================================
    // INTERACTION
    // ==================================================

    if (!interaction.isButton()) return;

    // ==================================================
    // GUILD
    // ==================================================

    if (!interaction.guildId) {
      return interaction.reply({
        content: "❌ Ta akcja działa tylko na serwerze.",
        ephemeral: true,
      });
    }

    // ==================================================
    // STAGE
    // ==================================================

    const match = String(interaction.customId || "").match(
      /^start_swiss_(.+)$/,
    );

    const stage = match?.[1]?.toLowerCase();

    if (!stage || !VALID_STAGES.has(stage)) {
      return interaction.reply({
        content: "❌ Nieprawidłowy etap Swiss.",
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
      // ==============================================
      // ACTIVE PUBLIC PANEL GUARD
      // ==============================================
      //
      // Ten guard sprawdza PUBLICZNY panel Discorda.
      // Nie używamy go później na ephemeral selectach,
      // bo tam message_id jest już inne.
      // ==============================================

      const panelGate = await assertActivePredictionPanel({
        pool,
        guildId,
        messageId: interaction.message?.id,
        phase: "swiss",
        stage,
      });

      if (!panelGate.allowed) {
        return interaction.editReply({
          content:
            panelGate.message || "❌ Ten panel Swiss nie jest już aktywny.",
          embeds: [],
          components: [],
        });
      }

      // ==============================================
      // PHASE / DEADLINE GUARD
      // ==============================================

      const gate = await assertPredictionsAllowed({
        guildId,
        kind: "SWISS",
        stage,
      });

      if (!gate.allowed) {
        return interaction.editReply({
          content:
            gate.message || "❌ Typowanie tej fazy jest aktualnie niedostępne.",
          embeds: [],
          components: [],
        });
      }

      // ==============================================
      // CURRENT EVENT
      // ==============================================

      const eventId = await getOpenEventId(pool, guildId);

      if (!eventId) {
        return interaction.editReply({
          content: "❌ Nie znaleziono aktywnego eventu.",
          embeds: [],
          components: [],
        });
      }

      // ==============================================
      // EVENT + STAGE BOUND DRAFT
      // ==============================================

      const cacheKey = `${guildId}:${interaction.user.id}:${stage}`;

      const existingDraft = getDraft(NAMESPACE, cacheKey);

      const sameEvent = Number(existingDraft?.eventId) === Number(eventId);

      const sameStage =
        String(existingDraft?.stage || "").toLowerCase() === stage;

      // Zachowujemy draft tylko wtedy, gdy pochodzi
      // dokładnie z tego samego eventu i stage'a.
      if (!sameEvent || !sameStage) {
        setDraft(NAMESPACE, cacheKey, {
          eventId: Number(eventId),
          stage,
        });
      }

      // ==============================================
      // TEAMS
      // ==============================================

      const teams = await loadTeamsWithFlags(pool, guildId);

      if (!teams.length) {
        return interaction.editReply({
          content: "❌ Brak aktywnych drużyn w bazie.",
          embeds: [],
          components: [],
        });
      }

      if (teams.length > 25) {
        return interaction.editReply({
          content: `⚠️ Jest **${teams.length} drużyn**, a Discord pozwala maksymalnie **25 opcji** w jednym dropdownie.`,
          embeds: [],
          components: [],
        });
      }

      // ==============================================
      // EMBED
      // ==============================================

      const teamList = teams.map((team) => team.label).join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`📋 Typowanie – SWISS (${stage.toUpperCase()})`)
        .setDescription("Wybierz swoje typy i kliknij **Zatwierdź typy**.")
        .addFields({
          name: "📌 Dostępne drużyny:",
          value: teamList,
        })
        .setColor("#0099ff");

      // ==============================================
      // OPTIONS
      // ==============================================

      const options = teams.map((team) => ({
        label: team.label,
        value: team.name,
      }));

      // ==============================================
      // COMPONENTS
      // ==============================================

      const rows = [
        // 3-0
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`swiss_3_0:${stage}`)
            .setPlaceholder("🔥 Wybierz 2 drużyny 3-0")
            .setMinValues(2)
            .setMaxValues(2)
            .addOptions(options),
        ),

        // 0-3
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`swiss_0_3:${stage}`)
            .setPlaceholder("💀 Wybierz 2 drużyny 0-3")
            .setMinValues(2)
            .setMaxValues(2)
            .addOptions(options),
        ),

        // ADVANCING
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`swiss_advancing:${stage}`)
            .setPlaceholder("🚀 Wybierz 6 drużyn 3-1 / 3-2")
            .setMinValues(6)
            .setMaxValues(6)
            .addOptions(options),
        ),

        // CONFIRM
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_swiss:${stage}`)
            .setLabel("✅ Zatwierdź typy")
            .setStyle(ButtonStyle.Success),
        ),
      ];

      // ==============================================
      // RESPONSE
      // ==============================================

      return interaction.editReply({
        embeds: [embed],
        components: rows,
      });
    });
  } catch (err) {
    // ==================================================
    // ERROR
    // ==================================================

    logError("swiss", "openSwissDropdown failed", {
      guildId: interaction.guildId,
      message: err?.message,
      stack: err?.stack,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction
        .editReply({
          content: "❌ Wystąpił błąd podczas generowania Swiss.",
          embeds: [],
          components: [],
        })
        .catch(() => {});
    }

    return interaction
      .reply({
        content: "❌ Wystąpił błąd podczas generowania Swiss.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
