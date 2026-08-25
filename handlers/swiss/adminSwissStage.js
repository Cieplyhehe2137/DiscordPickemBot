const { PermissionFlagsBits } = require("discord.js");

const { publishPickemPanel } = require("../../utils/pickemPanelPublisher");

const { withGuild } = require("../../utils/guildContext");

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

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

  const raw = String(interaction.values?.[0] || "");

  if (!raw) {
    return interaction.editReply({
      content: "❌ Nie wybrano etapu.",
    });
  }

  const stageNumber = raw.match(/\d+/)?.[0];

  if (!stageNumber) {
    return interaction.editReply({
      content: "❌ Nie udało się rozpoznać numeru etapu Swiss.",
    });
  }

  const phase = `swiss_stage${stageNumber}`;

  try {
    return withGuild(guildId, async ({ pool }) => {
      // ==================================================
      // AKTYWNY EVENT
      // ==================================================

      const [[event]] = await pool.query(
        `
            SELECT
              id,
              name
            FROM events
            WHERE guild_id = ?
              AND status = 'OPEN'
            ORDER BY id DESC
            LIMIT 1
            `,
        [guildId],
      );

      if (!event) {
        return interaction.editReply({
          content: "❌ Nie znaleziono aktywnego eventu.",
        });
      }

      const eventId = Number(event.id);

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
