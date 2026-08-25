const isAdmin = require("../../utils/isAdmin");

const { buildSwissStageSelector } = require("../../utils/pickemPanelBuilder");

const { publishPickemPanel } = require("../../utils/pickemPanelPublisher");

const { withGuild } = require("../../utils/guildContext");

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) {
    return;
  }

  if (interaction.customId !== "select_pickem_phase") {
    return;
  }

  // ======================================================
  // GUILD
  // ======================================================

  if (!interaction.guildId) {
    return interaction.reply({
      content: "❌ Ta akcja działa tylko na serwerze.",
      ephemeral: true,
    });
  }

  // ======================================================
  // ADMIN
  // ======================================================

  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "❌ Brak uprawnień do użycia tego panelu.",
      ephemeral: true,
    });
  }

  // ======================================================
  // DANE Z SELECTA
  // ======================================================

  const rawValue = String(interaction.values?.[0] || "");

  const [selected, rawEventId] = rawValue.split(":");

  const eventId = Number(rawEventId);

  if (!eventId) {
    return interaction.reply({
      content: "❌ Nieprawidłowe ID eventu.",
      ephemeral: true,
    });
  }

  try {
    await interaction.deferReply({
      ephemeral: true,
    });

    return withGuild(interaction, async ({ pool, guildId }) => {
      // ==================================================
      // EVENT
      // ==================================================

      const [[event]] = await pool.query(
        `
            SELECT
              id,
              name,
              slug,
              status
            FROM events
            WHERE id = ?
              AND guild_id = ?
            LIMIT 1
            `,
        [eventId, guildId],
      );

      if (!event) {
        return interaction.editReply({
          content: "❌ Nie znaleziono eventu przypisanego do tego panelu.",
        });
      }

      // ==================================================
      // SWISS — WYBÓR STAGE
      // ==================================================

      if (selected === "swiss") {
        const payload = buildSwissStageSelector(event);

        return interaction.followUp({
          ...payload,
          ephemeral: true,
        });
      }

      // ==================================================
      // DOZWOLONE FAZY
      // ==================================================

      const allowedPhases = new Set(["playoffs", "doubleelim", "playin"]);

      if (!allowedPhases.has(selected)) {
        return interaction.editReply({
          content: `❌ Nieznana faza: ${selected}`,
        });
      }

      // ==================================================
      // PUBLIKACJA PANELU
      // ==================================================

      await publishPickemPanel({
        client: interaction.client,

        pool,

        guildId,

        eventId,

        phase: selected,

        channelId: interaction.channel.id,
      });

      // ==================================================
      // SUCCESS
      // ==================================================

      return interaction.editReply({
        content:
          `✅ Panel dla fazy **${selected}** został opublikowany.\n` +
          `🏆 Event: **${event.name}**`,
      });
    });
  } catch (err) {
    console.error("[select_pickem_phase]", err);

    if (interaction.deferred || interaction.replied) {
      return interaction
        .editReply({
          content: "❌ Wystąpił błąd podczas publikowania panelu.",
        })
        .catch(() => {});
    }

    return interaction
      .reply({
        content: "❌ Wystąpił błąd podczas publikowania panelu.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
