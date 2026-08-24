const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
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

const phasesConfig = {
  swiss: {
    title: "Typowanie fazy Swiss",
    description:
      "Typujesz drużyny w fazie Swiss:\n\n" +
      "🆙 2 drużyny na 3-0\n" +
      "🆘 2 drużyny na 0-3\n" +
      "🏅 6 drużyn awansujących\n" +
      "\n━━━━━━━━━━━━━━\n" +
      "⏰ Deadline typowania drużyn ustawiany jest osobno.\n" +
      "🎯 Wyniki meczów typujesz osobno — deadline zależy od startu meczu.",
    buttonLabel: "Typuj drużyny Swiss",
    buttonId: "open_swiss_modal",
    color: "Blue",
  },

  playoffs: {
    title: "Typowanie fazy Playoffs",
    description:
      "Typujesz:\n\n" +
      "🏆 4 półfinalistów\n" +
      "🥈 2 finalistów\n" +
      "👑 Zwycięzcę turnieju\n" +
      "🥉 3. miejsce (opcjonalnie)\n" +
      "\n━━━━━━━━━━━━━━\n" +
      "⏰ Deadline typowania fazy ustawiany jest osobno.\n" +
      "🎯 Wyniki meczów typujesz osobno — deadline zależy od startu meczu.",
    buttonLabel: "Typuj Playoffs",
    buttonId: "open_playoffs_modal",
    color: "Green",
  },

  doubleelim: {
    title: "Typowanie fazy Double Elimination",
    description:
      "Typujesz:\n\n" +
      "🔵 2 drużyny z Upper Final A\n" +
      "🔴 2 drużyny z Lower Final A\n" +
      "🟢 2 drużyny z Upper Final B\n" +
      "🟣 2 drużyny z Lower Final B\n" +
      "\n━━━━━━━━━━━━━━\n" +
      "⏰ Deadline typowania fazy ustawiany jest osobno.\n" +
      "🎯 Wyniki meczów typujesz osobno — deadline zależy od startu meczu.",
    buttonLabel: "Typuj Double Elim",
    buttonId: "open_doubleelim_dropdown",
    color: "Purple",
  },

  playin: {
    title: "Typowanie fazy Play-In",
    description:
      "Typujesz:\n\n" +
      "🎯 8 drużyn awansujących z Play-In\n" +
      "\n━━━━━━━━━━━━━━\n" +
      "⏰ Deadline typowania fazy ustawiany jest osobno.\n" +
      "🎯 Wyniki meczów typujesz osobno — deadline zależy od startu meczu.",
    buttonLabel: "Typuj Play-In",
    buttonId: "open_playin_modal",
    color: "DarkBlue",
  },
};

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
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        return interaction.reply({
          content: "🚫 Nie masz uprawnień do użycia tej komendy.",
          ephemeral: true,
        });
      }

      const guildId = interaction.guildId;

      if (!guildId) {
        return interaction.reply({
          content: "❌ Ta funkcja działa tylko na serwerze.",
          ephemeral: true,
        });
      }

      const eventName = interaction.options.getString("event", true).trim();

      if (!eventName) {
        return interaction.reply({
          content: "❌ Podaj poprawną nazwę eventu.",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      return withGuild(guildId, async ({ pool }) => {
        const slug = makeSlug(eventName) || `event-${Date.now()}`;

        const [existing] = await pool.query(
          `
          SELECT id, name, slug, phase, status
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
        } else {
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

        const embed = new EmbedBuilder()
          .setTitle("📌 Wybierz fazę turnieju, którą chcesz rozpocząć:")
          .setDescription(
            `Event: **${finalEventName}**\n` +
              `Slug: \`${slug}\`\n` +
              `ID eventu: \`${eventId}\`\n` +
              `${wasExistingEvent ? "♻️ Używam istniejącego eventu." : "🆕 Utworzono nowy event."}`,
          )
          .setColor("Orange");

        const selectMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("select_pickem_phase")
            .setPlaceholder("Wybierz fazę turnieju")
            .addOptions(
              { label: "Swiss", value: `swiss:${eventId}` },
              { label: "Playoffs", value: `playoffs:${eventId}` },
              { label: "Double Elimination", value: `doubleelim:${eventId}` },
              { label: "Play-In", value: `playin:${eventId}` },
            ),
        );

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

  async handlePhaseSelect(interaction) {
    try {
      if (!interaction.isStringSelectMenu()) return;
      if (interaction.customId !== "select_pickem_phase") return;

      console.log("[PICKEM] handlePhaseSelect fired", {
        customId: interaction.customId,
        values: interaction.values,
      });

      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        return interaction.reply({
          content: "🚫 Nie masz uprawnień do tej akcji.",
          ephemeral: true,
        });
      }

      const guildId = interaction.guildId;

      if (!guildId) {
        return interaction.reply({
          content: "❌ Ta funkcja działa tylko na serwerze.",
          ephemeral: true,
        });
      }

      const rawValue = String(interaction.values?.[0] || "");
      const [selected, rawEventId] = rawValue.split(":");
      let eventId = Number(rawEventId);

      await interaction.deferReply({ ephemeral: true });

      return withGuild(guildId, async ({ pool }) => {
        const config = phasesConfig[selected];

        if (!config) {
          return interaction.editReply({
            content: `❌ Nieznana faza: ${rawValue}`,
          });
        }

        if (!eventId) {
          const [latestEvents] = await pool.query(
            `
            SELECT id
            FROM events
            WHERE guild_id = ?
              AND status = 'OPEN'
            ORDER BY id DESC
            LIMIT 1
            `,
            [guildId],
          );

          eventId = Number(latestEvents?.[0]?.id);
        }

        if (!eventId) {
          return interaction.editReply({
            content:
              "❌ Brak aktywnego eventu. Uruchom `/start_pickem event:nazwa` jeszcze raz.",
          });
        }

        const [events] = await pool.query(
          `
          SELECT id, name, slug, status
          FROM events
          WHERE id = ?
            AND guild_id = ?
          LIMIT 1
          `,
          [eventId, guildId],
        );

        if (!events.length) {
          return interaction.editReply({
            content: "❌ Nie znaleziono eventu dla tego panelu.",
          });
        }

        const event = events[0];

        await pool.query(
          `
          UPDATE events
          SET phase = ?, status = 'OPEN'
          WHERE id = ?
            AND guild_id = ?
          `,
          [selected, eventId, guildId],
        );

        await pool.query(
          `
          UPDATE active_panels
          SET active = 0
          WHERE guild_id = ?
            AND phase = ?
          `,
          [guildId, selected],
        );

        const embed = new EmbedBuilder()
          .setTitle(config.title)
          .setDescription(
            `🏆 Event: **${event.name}**\n\n` + config.description,
          )
          .setColor(config.color);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(config.buttonId)
            .setLabel(config.buttonLabel)
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId(`match_pick:${selected}`)
            .setLabel("🎯 Typuj wyniki meczów")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId(`my_predictions:${selected}:${eventId}:0`)
            .setLabel("📋 Moje typy")
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId(`my_stats:${eventId}`)
            .setLabel("📊 Moje statystyki")
            .setStyle(ButtonStyle.Secondary),
        );

        const message = await interaction.channel.send({
          content: "@everyone",
          embeds: [embed],
          components: [row],
          allowedMentions: {
            parse: ["everyone"],
          },
        });

        await pool.query(
          `
          INSERT INTO active_panels (
            guild_id,
            phase,
            channel_id,
            message_id,
            active,
            reminded,
            deadline
          )
          VALUES (?, ?, ?, ?, 1, 0, NULL)
          ON DUPLICATE KEY UPDATE
            message_id = VALUES(message_id),
            channel_id = VALUES(channel_id),
            active = 1,
            reminded = 0,
            deadline = NULL
          `,
          [guildId, selected, interaction.channel.id, message.id],
        );

        return interaction.editReply({
          content:
            `✅ Utworzono panel dla fazy **${config.title}**\n` +
            `🏆 Event: **${event.name}**`,
        });
      });
    } catch (err) {
      console.error("[PICKEM] handlePhaseSelect error", err);

      try {
        if (!interaction.deferred && !interaction.replied) {
          return interaction.reply({
            content: "❌ Błąd przy wyborze fazy.",
            ephemeral: true,
          });
        }

        return interaction.editReply({
          content: "❌ Błąd przy wyborze fazy.",
          components: [],
        });
      } catch (_) {
        return null;
      }
    }
  },
};
