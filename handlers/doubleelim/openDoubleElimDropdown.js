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
    ORDER BY name ASC
    `,
    [guildId],
  );

  return rows.map((r) => r.name).filter(Boolean);
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

    if (interaction.customId !== "open_doubleelim_modal") {
      return;
    }

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
      // ================================================
      // ACTIVE PANEL GUARD
      // ================================================
      //
      // Sprawdzamy, czy kliknięty przycisk pochodzi
      // z aktualnego panelu zapisanego w active_panels.
      //
      // Chroni to przed sytuacją:
      //
      // Event A -> Double Elim -> stary panel
      // Event B -> Double Elim -> aktualny panel
      //
      // Sama kontrola fazy nie wystarczyłaby, bo oba
      // eventy mają tę samą fazę.
      // ================================================

      const panelGate = await assertActivePredictionPanel({
        pool,
        guildId,
        messageId: interaction.message?.id,
        phase: "doubleelim",
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
        kind: "DOUBLEELIM",
      });

      if (!gate.allowed) {
        return interaction.editReply({
          content:
            gate.message ||
            "❌ Typowanie fazy Double Elimination jest aktualnie niedostępne.",
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
      // Formularz zostaje przypisany do konkretnego
      // eventu.
      //
      // Jeśli użytkownik ponownie otworzy formularz
      // tego samego eventu, zachowujemy jego wybory.
      //
      // Jeśli rozpoczął się nowy event, tworzymy
      // nowy pusty draft z nowym eventId.
      // ================================================

      const cacheKey = `${guildId}:${interaction.user.id}`;

      const existingDraft = getDraft("doubleelim", cacheKey);

      if (!existingDraft || Number(existingDraft.eventId) !== Number(eventId)) {
        setDraft("doubleelim", cacheKey, {
          eventId,
        });
      }

      // ================================================
      // TEAMS
      // ================================================

      const teams = await loadTeamsFromDB(pool, guildId);

      if (!teams.length) {
        return interaction.editReply({
          content:
            "⚠️ Brak drużyn w bazie. Najpierw dodaj drużyny w managerze.",
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
      // OPTIONS
      // ================================================

      const options = teams.map((team) => ({
        label: team,
        value: team,
      }));

      // ================================================
      // EMBED
      // ================================================

      const embed = new EmbedBuilder()
        .setColor("#ff6600")
        .setTitle("📌 Typowanie fazy Double Elimination")
        .setDescription(
          [
            "Wybierz po **2 drużyny** w każdej pozycji:",
            "• **Upper Final – Grupa A** (2)",
            "• **Lower Final – Grupa A** (2)",
            "• **Upper Final – Grupa B** (2)",
            "• **Lower Final – Grupa B** (2)",
            "",
            "⚠️ Drużyny **nie mogą się powtarzać** między slotami.",
            "Po wyborze kliknij **Zatwierdź typy**.",
          ].join("\n"),
        );

      // ================================================
      // UPPER FINAL A
      // ================================================

      const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("doubleelim_upper_final_a")
          .setPlaceholder("Upper Final – Grupa A (wybierz 2)")
          .setMinValues(2)
          .setMaxValues(2)
          .addOptions(options),
      );

      // ================================================
      // LOWER FINAL A
      // ================================================

      const row2 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("doubleelim_lower_final_a")
          .setPlaceholder("Lower Final – Grupa A (wybierz 2)")
          .setMinValues(2)
          .setMaxValues(2)
          .addOptions(options),
      );

      // ================================================
      // UPPER FINAL B
      // ================================================

      const row3 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("doubleelim_upper_final_b")
          .setPlaceholder("Upper Final – Grupa B (wybierz 2)")
          .setMinValues(2)
          .setMaxValues(2)
          .addOptions(options),
      );

      // ================================================
      // LOWER FINAL B
      // ================================================

      const row4 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("doubleelim_lower_final_b")
          .setPlaceholder("Lower Final – Grupa B (wybierz 2)")
          .setMinValues(2)
          .setMaxValues(2)
          .addOptions(options),
      );

      // ================================================
      // CONFIRM
      // ================================================

      const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_doubleelim")
          .setLabel("✅ Zatwierdź typy")
          .setStyle(ButtonStyle.Success),
      );

      // ================================================
      // RESPONSE
      // ================================================

      return interaction.editReply({
        embeds: [embed],
        components: [row1, row2, row3, row4, row5],
      });
    });
  } catch (err) {
    logError("doubleelim", "openDoubleElimDropdown failed", {
      guildId: interaction.guildId,
      message: err?.message,
      stack: err?.stack,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction
        .editReply({
          content: "❌ Błąd otwierania Pick'Em Double Elimination.",
          embeds: [],
          components: [],
        })
        .catch(() => {});
    }

    return interaction
      .reply({
        content: "❌ Błąd otwierania Pick'Em Double Elimination.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
