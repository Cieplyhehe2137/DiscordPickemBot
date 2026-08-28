const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { withGuild } = require("../utils/guildContext");

// ======================================================
// SLUG
// ======================================================

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

// ======================================================
// COMMAND
// ======================================================

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
    // EVENT NAME
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

    try {
      return withGuild(guildId, async ({ pool }) => {
        const slug = makeSlug(eventName) || `event-${Date.now()}`;

        const conn = await pool.getConnection();

        let eventId;
        let finalEventName = eventName;
        let wasExistingEvent = false;

        try {
          await conn.beginTransaction();

          // ==============================================
          // FIND EXISTING EVENT
          // ==============================================

          const [existing] = await conn.query(
            `
            SELECT
              id,
              name,
              slug,
              phase,
              status,
              is_open,
              is_active,
              is_archived
            FROM events
            WHERE guild_id = ?
              AND slug = ?
            LIMIT 1
            FOR UPDATE
            `,
            [guildId, slug],
          );

          // ==============================================
          // EXISTING EVENT
          // ==============================================

          if (existing.length) {
            const event = existing[0];

            // Nie wznawiamy eventów zakończonych/archiwalnych
            // przez przypadkowe użycie tego samego sluga.
            if (
              event.status === "FINISHED" ||
              event.status === "ARCHIVED" ||
              Number(event.is_archived) === 1
            ) {
              await conn.rollback();

              return interaction.editReply({
                content:
                  "❌ Event o tej nazwie jest już zakończony lub zarchiwizowany.\n" +
                  "Użyj innej nazwy eventu.",
                embeds: [],
                components: [],
              });
            }

            eventId = Number(event.id);
            finalEventName = event.name;
            wasExistingEvent = true;

            // --------------------------------------------
            // PREPARE ONLY
            // --------------------------------------------
            //
            // Nie aktywujemy eventu tutaj.
            // Publisher zrobi to dopiero po poprawnym
            // utworzeniu publicznego panelu.
            // --------------------------------------------

            await conn.query(
              `
              UPDATE events
              SET
                status = CASE
                  WHEN status = 'OPEN' THEN 'UPCOMING'
                  ELSE status
                END,
                is_open = 0,
                is_active = 0
              WHERE id = ?
                AND guild_id = ?
              `,
              [eventId, guildId],
            );
          }

          // ==============================================
          // NEW EVENT
          // ==============================================

          else {
            const [result] = await conn.query(
              `
              INSERT INTO events (
                guild_id,
                slug,
                name,
                phase,
                status,
                is_open,
                is_active
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
              [
                guildId,
                slug,
                eventName,
                "NOT_STARTED",
                "UPCOMING",
                0,
                0,
              ],
            );

            eventId = Number(result.insertId);
          }

          await conn.commit();
        } catch (err) {
          try {
            await conn.rollback();
          } catch (_) {
            // ignore rollback error
          }

          throw err;
        } finally {
          conn.release();
        }

        // ==================================================
        // PHASE SELECT EMBED
        // ==================================================

        const embed = new EmbedBuilder()
          .setTitle("📌 Wybierz fazę turnieju, którą chcesz rozpocząć:")
          .setDescription(
            `🏆 Event: **${finalEventName}**\n` +
              `🔗 Slug: \`${slug}\`\n` +
              `🆔 ID eventu: \`${eventId}\`\n\n` +
              `${
                wasExistingEvent
                  ? "♻️ Przygotowano istniejący event."
                  : "🆕 Utworzono nowy event."
              }\n\n` +
              "ℹ️ Event zostanie aktywowany dopiero po opublikowaniu panelu fazy.",
          )
          .setColor("Orange");

        // ==================================================
        // PHASE SELECT
        // ==================================================

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

        // ==================================================
        // RESPONSE
        // ==================================================

        return interaction.editReply({
          embeds: [embed],
          components: [selectMenu],
        });
      });
    } catch (err) {
      console.error("[PICKEM] execute error", err);

      return interaction
        .editReply({
          content: "❌ Błąd przy tworzeniu eventu Pick’Em.",
          embeds: [],
          components: [],
        })
        .catch(() => null);
    }
  },
};