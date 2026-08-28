const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ComponentType,
  StringSelectMenuBuilder,
} = require("discord.js");

const { withGuild } = require("../utils/guildContext");
const { getOpenEventId } = require("../utils/getOpenEventId");
const { logInfo, logWarn, logError } = require("../utils/logger");

const ADMIN_USER_ID = process.env.PICKEM_ADMIN_ID || null;

// ======================================================
// DOZWOLONE FAZY
// ======================================================

const PHASES = {
  swiss_stage1: "Swiss 1",
  swiss_stage2: "Swiss 2",
  swiss_stage3: "Swiss 3",
  playoffs: "Playoffs",
  doubleelim: "Double Elim",
  playin: "Play-In",
};

// ======================================================
// KOMPONENTY TYPOWANIA
// ======================================================

const TYPING_BUTTON_PREFIXES = ["open_", "typuj_"];

function isTypingComponent(customId) {
  const id = String(customId || "");

  return TYPING_BUTTON_PREFIXES.some((prefix) => id.startsWith(prefix));
}

// ======================================================
// DISABLE PANEL COMPONENTS
// ======================================================

function disableTypingComponents(message) {
  let disabledCount = 0;

  const components = message.components.map((row) => {
    const newRow = new ActionRowBuilder();

    const rebuilt = row.components.map((component) => {
      const customId = component.customId || "";

      if (!isTypingComponent(customId)) {
        return component;
      }

      // ================================================
      // BUTTON
      // ================================================

      if (component.type === ComponentType.Button) {
        disabledCount += 1;

        const button = ButtonBuilder.from(component);

        return button
          .setLabel("Typowanie zakończone")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);
      }

      // ================================================
      // STRING SELECT
      // ================================================

      if (component.type === ComponentType.StringSelect) {
        disabledCount += 1;

        return StringSelectMenuBuilder.from(component).setDisabled(true);
      }

      return component;
    });

    newRow.addComponents(...rebuilt);

    return newRow;
  });

  return {
    components,
    disabledCount,
  };
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("end_pickem")
    .setDescription(
      "🛑 Ręcznie zamyka fazę Pick'Em i dezaktywuje przyciski typowania",
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator,
    ),

  async execute(interaction) {
    try {
      // ==================================================
      // UPRAWNIENIA
      // ==================================================

      const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;

      const isEnvAdmin = ADMIN_USER_ID && ADMIN_USER_ID === interaction.user.id;

      const hasManageGuild =
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

      if (!(isGuildOwner || isEnvAdmin || hasManageGuild)) {
        return interaction.reply({
          content: "❌ Nie masz uprawnień do użycia tej komendy.",
          ephemeral: true,
        });
      }

      // ==================================================
      // GUILD
      // ==================================================

      const guildId = interaction.guildId;

      if (!guildId) {
        return interaction.reply({
          content: "❌ Ta funkcja działa tylko na serwerze (nie w DM).",
          ephemeral: true,
        });
      }

      // ==================================================
      // SPRAWDŹ AKTYWNY EVENT
      // ==================================================
      //
      // Canonical lifecycle:
      //
      // status    = OPEN
      // is_open   = 1
      // is_active = 1
      // ==================================================

      const eventState = await withGuild(guildId, async ({ pool }) => {
        const eventId = await getOpenEventId(pool, guildId);

        if (!eventId) {
          return null;
        }

        const [[event]] = await pool.query(
          `
            SELECT
              id,
              name,
              phase
            FROM events
            WHERE id = ?
              AND guild_id = ?
            LIMIT 1
            `,
          [eventId, guildId],
        );

        if (!event) {
          return null;
        }

        return {
          eventId: Number(event.id),
          eventName: event.name,
          phase: event.phase,
        };
      });

      if (!eventState) {
        return interaction.reply({
          content: "❌ Brak aktywnego eventu Pick'Em.",
          ephemeral: true,
        });
      }

      // ==================================================
      // EMBED
      // ==================================================

      const embed = new EmbedBuilder()
        .setTitle("🛑 Zamykanie fazy Pick'Em")
        .setDescription(
          `🏆 Event: **${eventState.eventName}**\n` +
            `📌 Aktualna faza: \`${eventState.phase}\`\n\n` +
            "Kliknij fazę, którą chcesz zamknąć.\n" +
            "Panel zostanie oznaczony jako zamknięty i typowanie zostanie dezaktywowane.",
        )
        .setColor("Red");

      // ==================================================
      // BUTTONS
      // ==================================================

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_phase_swiss_stage1")
          .setLabel("Zamknij Swiss 1")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("close_phase_swiss_stage2")
          .setLabel("Zamknij Swiss 2")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("close_phase_swiss_stage3")
          .setLabel("Zamknij Swiss 3")
          .setStyle(ButtonStyle.Danger),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_phase_playoffs")
          .setLabel("Zamknij Playoffs")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("close_phase_doubleelim")
          .setLabel("Zamknij Double Elim")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("close_phase_playin")
          .setLabel("Zamknij Play-In")
          .setStyle(ButtonStyle.Danger),
      );

      // ==================================================
      // RESPONSE
      // ==================================================

      const response = await interaction.reply({
        embeds: [embed],
        components: [row1, row2],
        ephemeral: true,
        fetchReply: true,
      });

      // ==================================================
      // COLLECTOR
      // ==================================================

      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300_000,

        filter: (i) =>
          i.customId?.startsWith("close_phase_") &&
          i.user.id === interaction.user.id,
      });

      // ==================================================
      // COLLECT
      // ==================================================

      collector.on("collect", async (i) => {
        const currentGuildId = i.guildId;

        if (!currentGuildId) {
          return i.reply({
            content: "❌ Ta funkcja działa tylko na serwerze (nie w DM).",
            ephemeral: true,
          });
        }

        try {
          await i.deferUpdate();

          const phase = String(i.customId).replace("close_phase_", "");

          // ================================================
          // VALIDATE PHASE
          // ================================================

          if (!Object.prototype.hasOwnProperty.call(PHASES, phase)) {
            return i.followUp({
              content: "❌ Nieprawidłowa faza Pick'Em.",
              ephemeral: true,
            });
          }

          return withGuild(currentGuildId, async ({ pool }) => {
            // ============================================
            // CURRENT EVENT
            // ============================================
            //
            // Sprawdzamy ponownie przy kliknięciu.
            //
            // Przez 5 minut od uruchomienia /end_pickem
            // event mógł się zmienić.
            // ============================================

            const currentEventId = await getOpenEventId(pool, currentGuildId);

            if (!currentEventId) {
              return i.followUp({
                content: "❌ Nie ma już aktywnego eventu Pick'Em.",
                ephemeral: true,
              });
            }

            // ============================================
            // EVENT MUSI BYĆ TEN SAM
            // ============================================

            if (Number(currentEventId) !== Number(eventState.eventId)) {
              return i.followUp({
                content:
                  "❌ Event zmienił się od czasu otwarcia tego formularza.\n" +
                  "Uruchom `/end_pickem` ponownie.",
                ephemeral: true,
              });
            }

            // ============================================
            // CURRENT PHASE
            // ============================================

            const [[currentEvent]] = await pool.query(
              `
                SELECT
                  id,
                  phase
                FROM events
                WHERE id = ?
                  AND guild_id = ?
                LIMIT 1
                `,
              [currentEventId, currentGuildId],
            );

            if (!currentEvent) {
              return i.followUp({
                content: "❌ Nie udało się odczytać aktywnego eventu.",
                ephemeral: true,
              });
            }

            // ============================================
            // NIE POZWALAJ ZAMKNĄĆ INNEJ FAZY
            // ============================================
            //
            // Jeżeli aktualna faza to playoffs,
            // stary przycisk Swiss nie powinien nic zrobić.
            // ============================================

            if (
              String(currentEvent.phase).toLowerCase() !== phase.toLowerCase()
            ) {
              return i.followUp({
                content:
                  `❌ Aktualna faza eventu to \`${currentEvent.phase}\`, ` +
                  `a próbujesz zamknąć \`${phase}\`.\n` +
                  "Uruchom `/end_pickem` ponownie.",
                ephemeral: true,
              });
            }

            // ============================================
            // ACTIVE PANEL
            // ============================================

            const [rows] = await pool.query(
              `
                SELECT
                  id,
                  message_id,
                  channel_id,
                  phase,
                  closed,
                  active
                FROM active_panels
                WHERE guild_id = ?
                  AND phase = ?
                  AND active = 1
                  AND COALESCE(closed, 0) = 0
                ORDER BY id DESC
                LIMIT 1
                `,
              [currentGuildId, phase],
            );

            const panel = rows[0];

            if (!panel) {
              return i.followUp({
                content: `❌ Nie znaleziono aktywnego panelu dla fazy \`${phase}\`.`,
                ephemeral: true,
              });
            }

            // ============================================
            // DISCORD PANEL
            // ============================================

            let editOk = false;
            let disabledCount = 0;

            if (panel.message_id && panel.channel_id) {
              try {
                const channel = await i.client.channels.fetch(
                  String(panel.channel_id),
                );

                if (
                  !channel ||
                  !channel.messages ||
                  typeof channel.messages.fetch !== "function"
                ) {
                  throw new Error(
                    `Channel ${panel.channel_id} does not support messages`,
                  );
                }

                const panelMessage = await channel.messages.fetch(
                  String(panel.message_id),
                );

                const result = disableTypingComponents(panelMessage);

                disabledCount = result.disabledCount;

                if (disabledCount > 0) {
                  await panelMessage.edit({
                    components: result.components,
                  });
                }

                editOk = true;
              } catch (err) {
                logWarn("end_pickem", "Could not disable Discord panel", {
                  guildId: currentGuildId,
                  eventId: currentEventId,
                  phase,
                  messageId: panel.message_id,
                  channelId: panel.channel_id,
                  message: err?.message,
                });
              }
            }

            // ============================================
            // CLOSE PANEL — TRANSACTION
            // ============================================

            const conn = await pool.getConnection();

            try {
              await conn.beginTransaction();

              // ------------------------------------------
              // Re-check event under lock
              // ------------------------------------------

              const [[lockedEvent]] = await conn.query(
                `
                  SELECT
                    id,
                    phase,
                    status,
                    is_open,
                    is_active
                  FROM events
                  WHERE id = ?
                    AND guild_id = ?
                  FOR UPDATE
                  `,
                [currentEventId, currentGuildId],
              );

              if (
                !lockedEvent ||
                lockedEvent.status !== "OPEN" ||
                Number(lockedEvent.is_open) !== 1 ||
                Number(lockedEvent.is_active) !== 1
              ) {
                throw new Error("Event is no longer active");
              }

              if (
                String(lockedEvent.phase).toLowerCase() !== phase.toLowerCase()
              ) {
                throw new Error(`Event phase changed to ${lockedEvent.phase}`);
              }

              // ------------------------------------------
              // Close exact panel
              // ------------------------------------------

              const [panelUpdate] = await conn.query(
                `
                  UPDATE active_panels
                  SET
                    closed = 1,
                    closed_at = NOW(),
                    active = 0
                  WHERE id = ?
                    AND guild_id = ?
                    AND phase = ?
                    AND active = 1
                    AND COALESCE(closed, 0) = 0
                  `,
                [panel.id, currentGuildId, phase],
              );

              if (panelUpdate.affectedRows !== 1) {
                throw new Error(
                  `Panel ${panel.id} was already closed or changed`,
                );
              }

              await conn.commit();
            } catch (err) {
              await conn.rollback().catch(() => {});

              throw err;
            } finally {
              conn.release();
            }

            // ============================================
            // SUCCESS
            // ============================================

            logInfo("end_pickem", "Pick'Em phase closed", {
              guildId: currentGuildId,
              eventId: currentEventId,
              phase,
              panelId: panel.id,
              messageId: panel.message_id,
              discordPanelEdited: editOk,
              disabledCount,
              actorId: i.user.id,
            });

            collector.stop("phase_closed");

            return i.followUp({
              ephemeral: true,

              content: editOk
                ? `✅ Faza \`${PHASES[phase]}\` została zamknięta i typowanie dezaktywowane.`
                : `✅ Faza \`${PHASES[phase]}\` została zamknięta w bazie.\n⚠️ Nie udało się zmodyfikować wiadomości panelu na Discordzie.`,
            });
          });
        } catch (err) {
          logError("end_pickem", "Error while closing Pick'Em phase", {
            guildId: currentGuildId,
            userId: i.user.id,
            message: err?.message,
            stack: err?.stack,
          });

          return i
            .followUp({
              ephemeral: true,
              content: "❌ Błąd podczas zamykania fazy Pick'Em.",
            })
            .catch(() => null);
        }
      });

      // ==================================================
      // COLLECTOR END
      // ==================================================

      collector.on("end", async (_, reason) => {
        if (reason === "phase_closed") {
          return;
        }

        // Po wygaśnięciu formularza wyłączamy przyciski
        // administracyjne, żeby nie wyglądały na aktywne.

        try {
          const disabledRows = [row1, row2].map((row) => {
            const newRow = new ActionRowBuilder();

            newRow.addComponents(
              ...row.components.map((component) =>
                ButtonBuilder.from(component).setDisabled(true),
              ),
            );

            return newRow;
          });

          await interaction.editReply({
            components: disabledRows,
          });
        } catch {
          // Formularz mógł już zostać usunięty.
        }
      });
    } catch (err) {
      logError("end_pickem", "Command failed", {
        guildId: interaction.guildId,
        userId: interaction.user?.id,
        message: err?.message,
        stack: err?.stack,
      });

      if (interaction.deferred || interaction.replied) {
        return interaction
          .followUp({
            ephemeral: true,
            content: "❌ Wystąpił błąd podczas uruchamiania komendy.",
          })
          .catch(() => null);
      }

      return interaction
        .reply({
          ephemeral: true,
          content: "❌ Wystąpił błąd podczas uruchamiania komendy.",
        })
        .catch(() => null);
    }
  },
};
