const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { withGuild } = require("../utils/guildContext");

function makeSlug(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("start_pickem")
    .setDescription("Tworzy event Pick’Em i rozpoczyna wybór fazy turnieju")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("Nazwa eventu, np. IEM Cologne 2026")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator,
    ),

  async execute(interaction) {
    try {
      // ==================================================
      // UPRAWNIENIA
      // ==================================================

      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        return interaction.reply({
          content: "🚫 Nie masz uprawnień do użycia tej komendy.",
          ephemeral: true,
        });
      }

      // ==================================================
      // GUILD
      // ==================================================

      const guildId = interaction.guildId;

      if (!guildId) {
        return interaction.reply({
          content: "❌ Ta funkcja działa tylko na serwerze.",
          ephemeral: true,
        });
      }

      // ==================================================
      // NAZWA EVENTU
      // ==================================================

      const eventName = interaction.options.getString("event", true).trim();

      if (!eventName) {
        return interaction.reply({
          content: "❌ Podaj poprawną nazwę eventu.",
          ephemeral: true,
        });
      }

      await interaction.deferReply({
        ephemeral: true,
      });

      // ==================================================
      // EVENT
      // ==================================================

      return withGuild(guildId, async ({ pool }) => {
        const slug = makeSlug(eventName) || `event-${Date.now()}`;

        const [existing] = await pool.query(
          `
              SELECT
                id,
                name,
                slug,
                phase,
                status
              FROM events
              WHERE guild_id = ?
                AND slug = ?
              LIMIT 1
              `,
          [guildId, slug],
        );

        let eventId;
        let finalEventName = eventName;

        let wasExistingEvent = false;

        // ==============================================
        // ISTNIEJĄCY EVENT
        // ==============================================

        if (existing.length) {
          const event = existing[0];

          eventId = event.id;

          finalEventName = event.name;

          wasExistingEvent = true;

          await pool.query(
            `
              UPDATE events
              SET status = 'OPEN'
              WHERE id = ?
                AND guild_id = ?
              `,
            [eventId, guildId],
          );
        }

        // ==============================================
        // NOWY EVENT
        // ==============================================
        else {
          const [result] = await pool.query(
            `
                INSERT INTO events (
                  guild_id,
                  slug,
                  name,
                  phase,
                  status
                )
                VALUES (?, ?, ?, ?, ?)
                `,
            [guildId, slug, eventName, "NOT_STARTED", "OPEN"],
          );

          eventId = result.insertId;
        }

        // ==============================================
        // EMBED WYBORU FAZY
        // ==============================================

        const embed = new EmbedBuilder()
          .setTitle("📌 Wybierz fazę turnieju, którą chcesz rozpocząć:")
          .setDescription(
            `🏆 Event: **${finalEventName}**\n` +
              `🔗 Slug: \`${slug}\`\n` +
              `🆔 ID eventu: \`${eventId}\`\n\n` +
              `${
                wasExistingEvent
                  ? "♻️ Używam istniejącego eventu."
                  : "🆕 Utworzono nowy event."
              }`,
          )
          .setColor("Orange");

        // ==============================================
        // SELECT FAZY
        // ==============================================

        const selectMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("select_pickem_phase")
            .setPlaceholder("Wybierz fazę turnieju")
            .addOptions(
              {
                label: "Swiss",
                value: `swiss:${eventId}`,
              },
              {
                label: "Playoffs",
                value: `playoffs:${eventId}`,
              },
              {
                label: "Double Elimination",
                value: `doubleelim:${eventId}`,
              },
              {
                label: "Play-In",
                value: `playin:${eventId}`,
              },
            ),
        );

        // ==============================================
        // RESPONSE
        // ==============================================

        return interaction.editReply({
          embeds: [embed],
          components: [selectMenu],
        });
      });
    } catch (err) {
      console.error("[PICKEM] execute error", err);

      try {
        if (!interaction.deferred && !interaction.replied) {
          return interaction.reply({
            content: "❌ Błąd przy tworzeniu eventu Pick’Em.",
            ephemeral: true,
          });
        }

        return interaction.editReply({
          content: "❌ Błąd przy tworzeniu eventu Pick’Em.",
          components: [],
        });
      } catch (_) {
        return null;
      }
    }
  },
};
