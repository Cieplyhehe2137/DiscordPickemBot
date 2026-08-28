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
const { setDraft } = require("../../utils/predictionDraftCache");
const { getOpenEventId } = require("../../utils/getOpenEventId");

// ======================================================
// HANDLER
// ======================================================

module.exports = async (interaction) => {
  try {
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
      // ==================================================
      // PROTECTION GUARD
      // ==================================================

      const gate = await assertPredictionsAllowed({
        guildId,
        kind: "PLAYIN",
      });

      const panelGate = await assertActivePredictionPanel({
        pool,
        guildId,
        messageId: interaction.message?.id,
        phase: "playin",
      });

      if (!panelGate.allowed) {
        return interaction.editReply({
          content: panelGate.message,
          embeds: [],
          components: [],
        });
      }

      if (!gate.allowed) {
        return interaction.editReply({
          content:
            gate.message ||
            "❌ Typowanie fazy Play-In jest aktualnie niedostępne.",
          embeds: [],
          components: [],
        });
      }

      // ==================================================
      // EVENT BOUND DRAFT
      // ==================================================

      const eventId = await getOpenEventId(pool, guildId);

      if (!eventId) {
        return interaction.editReply({
          content: "❌ Nie znaleziono aktywnego eventu.",
          embeds: [],
          components: [],
        });
      }

      const cacheKey = `${guildId}:${interaction.user.id}`;

      setDraft("playin", cacheKey, {
        eventId,
        teams: [],
      });

      // ==================================================
      // TEAMS
      // ==================================================

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

      const teamNames = rows.map((row) => row.name).filter(Boolean);

      if (!teamNames.length) {
        return interaction.editReply({
          content: "❌ Brak aktywnych drużyn w bazie.",
          embeds: [],
          components: [],
        });
      }

      // Potrzebujemy minimum 8 drużyn,
      // bo użytkownik musi wybrać dokładnie 8.
      if (teamNames.length < 8) {
        return interaction.editReply({
          content:
            `❌ W bazie jest tylko **${teamNames.length} aktywnych drużyn**.\n` +
            `Do typowania Play-In potrzeba minimum **8**.`,
          embeds: [],
          components: [],
        });
      }

      // Discord pozwala maksymalnie na 25 opcji
      // w jednym StringSelectMenu.
      if (teamNames.length > 25) {
        return interaction.editReply({
          content: `⚠️ Jest **${teamNames.length} aktywnych drużyn**, a Discord pozwala na maksymalnie **25 opcji** w jednym dropdownie.`,
          embeds: [],
          components: [],
        });
      }

      // ==================================================
      // EMBED
      // ==================================================

      const embed = new EmbedBuilder()
        .setColor("#00b0f4")
        .setTitle("📌 Pick'Em – Play-In")
        .setDescription(
          [
            "Wybierz **dokładnie 8 drużyn**, które według Ciebie awansują z fazy Play-In.",
            "",
            "Po dokonaniu wyboru kliknij **Zatwierdź typy**.",
          ].join("\n"),
        );

      // ==================================================
      // OPTIONS
      // ==================================================

      const options = teamNames.map((team) => ({
        label: team,
        value: team,
      }));

      // ==================================================
      // SELECT
      // ==================================================

      const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("playin_select")
          .setPlaceholder("Wybierz dokładnie 8 drużyn")
          .setMinValues(8)
          .setMaxValues(8)
          .addOptions(options),
      );

      // ==================================================
      // CONFIRM
      // ==================================================

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_playin")
          .setLabel("✅ Zatwierdź typy")
          .setStyle(ButtonStyle.Success),
      );

      // ==================================================
      // RESPONSE
      // ==================================================

      return interaction.editReply({
        embeds: [embed],
        components: [selectRow, confirmRow],
      });
    });
  } catch (err) {
    logError("playin", "openPlayinDropdown failed", {
      guildId: interaction.guildId,
      message: err?.message,
      stack: err?.stack,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction
        .editReply({
          content: "❌ Błąd otwierania Pick'Em Play-In.",
          embeds: [],
          components: [],
        })
        .catch(() => {});
    }

    return interaction
      .reply({
        content: "❌ Błąd otwierania Pick'Em Play-In.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
