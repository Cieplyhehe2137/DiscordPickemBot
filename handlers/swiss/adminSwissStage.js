const { PermissionFlagsBits } = require("discord.js");

const { publishPickemPanel } = require("../../utils/pickemPanelPublisher");

const { withGuild } = require("../../utils/guildContext");

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) {
    return;
  }

  if (interaction.customId !== "admin_select_swiss_stage") {
    return;
  }

  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.reply({
      content: "❌ Ta akcja działa tylko na serwerze.",
      ephemeral: true,
    });
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({
      ephemeral: true,
    });
  }

  const perms = interaction.memberPermissions;

  if (
    !perms?.has(PermissionFlagsBits.ManageGuild) &&
    !perms?.has(PermissionFlagsBits.Administrator)
  ) {
    return interaction.editReply({
      content: "🚫 Nie masz uprawnień do utworzenia panelu.",
    });
  }

  // ======================================================
  // DANE Z SELECTA
  // ======================================================

  const raw = String(interaction.values?.[0] || "");

  const [rawPhase, rawEventId] = raw.split(":");

  const stageNumber = rawPhase.match(/\d+/)?.[0];

  const eventId = Number(rawEventId);

  if (!stageNumber) {
    return interaction.editReply({
      content: "❌ Nie udało się rozpoznać numeru etapu Swiss.",
    });
  }

  if (!eventId) {
    return interaction.editReply({
      content: "❌ Nieprawidłowe ID eventu.",
    });
  }

  const phase = `swiss_stage${stageNumber}`;

  try {
    return withGuild(guildId, async ({ pool }) => {
      // ==================================================
      // KONKRETNY EVENT
      // ==================================================

      const [[event]] = await pool.query(
        `
            SELECT
              id,
              name
            FROM events
            WHERE id = ?
              AND guild_id = ?
            LIMIT 1
            `,
        [eventId, guildId],
      );

      if (!event) {
        return interaction.editReply({
          content: "❌ Nie znaleziono eventu.",
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

        phase,

        channelId: interaction.channel.id,
      });

      // ==================================================
      // SUCCESS
      // ==================================================

      return interaction.editReply({
        content:
          `✅ Wysłano panel Swiss ` +
          `(STAGE ${stageNumber}).\n` +
          `🏆 Event: **${event.name}**`,
      });
    });
  } catch (err) {
    console.error("[adminSwissStage]", err);

    return interaction
      .editReply({
        content: "❌ Nie udało się wysłać panelu.",
      })
      .catch(() => {});
  }
};
