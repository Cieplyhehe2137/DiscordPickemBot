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
const { getPhaseLimits } = require("../../utils/eventPickemConfig");
const { druzyny } = require("../../utils/odmiana");

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

      // Ile drużyn awansuje - z konfiguracji tego eventu, nie na sztywno.
      const limity = await getPhaseLimits(pool, guildId, eventId, "playin");

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

      // W bazie musi być co najmniej tyle drużyn, ile trzeba wytypować.
      if (teamNames.length < limity.teams) {
        return interaction.editReply({
          content:
            `❌ W bazie jest tylko **${teamNames.length} aktywnych drużyn**.\n` +
            `Do typowania Play-In potrzeba minimum **${limity.teams}**.`,
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
            `Wybierz **dokładnie ${limity.teams} ${druzyny(limity.teams)}**, ` +
              "które według Ciebie awansują z fazy Play-In.",
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
          .setPlaceholder(
            `Wybierz dokładnie ${limity.teams} ${druzyny(limity.teams)}`,
          )
          .setMinValues(limity.teams)
          .setMaxValues(limity.teams)
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
