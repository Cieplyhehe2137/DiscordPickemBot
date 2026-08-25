const isAdmin = require("../../utils/isAdmin");

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

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
      // ======================================================
      // EVENT
      // ======================================================

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

      // ======================================================
      // SWISS
      // ======================================================

      if (selected === "swiss") {
        const swissDescription =
          "• 🆙 **2 drużyny na 3-0**\n" +
          "• 🆘 **2 drużyny na 0-3**\n" +
          "• 🏅 **6 drużyn awansujących**";

        const embed = new EmbedBuilder()
          .setColor("Orange")
          .setTitle("📌 Typowanie fazy Swiss")
          .setDescription(
            `🏆 **Event:** ${event.name}\n\n` +
              `🎯 **Typujesz:**\n` +
              `${swissDescription}\n\n` +
              `🔽 **Wybierz etap fazy Swiss:**`,
          );

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("admin_select_swiss_stage")
            .setPlaceholder("Wybierz etap Swiss...")
            .addOptions(
              {
                label: "Swiss Stage 1",
                value: "swiss_stage1",
              },

              {
                label: "Swiss Stage 2",
                value: "swiss_stage2",
              },

              {
                label: "Swiss Stage 3",
                value: "swiss_stage3",
              },
            ),
        );

        return interaction.followUp({
          embeds: [embed],
          components: [row],
          ephemeral: true,
        });
      }

      // ======================================================
      // POZOSTAŁE FAZY
      // ======================================================

      const phaseConfig = {
        playoffs: {
          color: "Green",

          title: "📌 Typowanie fazy Playoffs",

          description:
            "• 🏆 **4 półfinalistów**\n" +
            "• 🥈 **2 finalistów**\n" +
            "• 👑 **Zwycięzcę turnieju**\n" +
            "• 🥉 **3. miejsce (opcjonalnie)**",

          buttonId: "open_playoffs_dropdown",

          buttonLabel: "Typuj Playoffs",
        },

        doubleelim: {
          color: "Purple",

          title: "📌 Typowanie fazy Double Elim",

          description:
            "• 🔝 **Upper Final A (2)**\n" +
            "• 🔻 **Lower Final A (2)**\n" +
            "• 🔝 **Upper Final B (2)**\n" +
            "• 🔻 **Lower Final B (2)**",

          buttonId: "open_doubleelim_modal",

          buttonLabel: "Typuj Double Elim",
        },

        playin: {
          color: "Blue",

          title: "📌 Typowanie fazy Play-In",

          description: "• 🎯 **8 drużyn awansujących**",

          buttonId: "open_playin_dropdown",

          buttonLabel: "Typuj Play-In",
        },
      };

      const config = phaseConfig[selected];

      if (!config) {
        return interaction.editReply({
          content: `❌ Nieznana faza: ${selected}`,
        });
      }

      // ======================================================
      // EMBED
      // ======================================================

      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(config.title)
        .setDescription(
          `🏆 **Event:** ${event.name}\n\n` +
            `🎯 **Typujesz:**\n` +
            `${config.description}\n\n` +
            `🎮 **Mecze**\n` +
            `Typuj również wyniki poszczególnych spotkań.\n\n` +
            `📋 **Twoje dane**\n` +
            `Możesz w każdej chwili sprawdzić zapisane typy i statystyki.`,
        );

      // ======================================================
      // BUTTONY — TYPOWANIE
      // ======================================================

      const mainRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(config.buttonId)
          .setLabel(config.buttonLabel)
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`match_pick:${selected}`)
          .setLabel("Typuj mecze")
          .setEmoji("🎯")
          .setStyle(ButtonStyle.Success),
      );

      // ======================================================
      // BUTTONY — USER
      // ======================================================

      const playerRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`my_predictions:${selected}:${eventId}:0`)
          .setLabel("Moje typy")
          .setEmoji("📋")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`my_stats:${eventId}`)
          .setLabel("Moje statystyki")
          .setEmoji("📊")
          .setStyle(ButtonStyle.Secondary),
      );

      // ======================================================
      // PUBLIKACJA PANELU
      // ======================================================

      const msg = await interaction.channel.send({
        embeds: [embed],

        components: [mainRow, playerRow],
      });

      // ======================================================
      // ACTIVE PANEL
      // ======================================================

      await pool.query(
        `
          INSERT INTO active_panels (
            guild_id,
            phase,
            channel_id,
            message_id
          )

          VALUES (?, ?, ?, ?)

          ON DUPLICATE KEY UPDATE
            channel_id = VALUES(channel_id),
            message_id = VALUES(message_id)
          `,
        [guildId, selected, interaction.channel.id, msg.id],
      );

      // ======================================================
      // SUCCESS
      // ======================================================

      return interaction.editReply({
        content:
          `✅ Panel dla fazy **${selected}** został opublikowany.\n` +
          `🏆 Event: **${event.name}**`,
      });
    });
  } catch (err) {
    console.error("[select_pickem_phase]", err);

    if (interaction.deferred) {
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
