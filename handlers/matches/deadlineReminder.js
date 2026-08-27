// handlers/deadlineReminder.js
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const { DateTime } = require("luxon");
const { logInfo, logWarn, logError } = require("../../utils/logger.js");
const { withGuild } = require("../../utils/guildContext");

const _startedReminders = new Set();
const _deadlineIdleState = new Map();
const _runningGuilds = new Set();

function isMessageOlderThan(messageId, minutes = 1) {
  try {
    const DISCORD_EPOCH = 1420070400000n;
    const id = BigInt(messageId);
    const timestamp = Number((id >> 22n) + DISCORD_EPOCH);

    return Date.now() - timestamp > minutes * 60 * 1000;
  } catch {
    return true;
  }
}

function buildDeadlineLines(deadline) {
  const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);

  const unix = Math.floor(deadlineDate.getTime() / 1000);

  return [
    `⏰ **Deadline typowania drużyn:** <t:${unix}:F>`,
    `⏳ **Pozostało:** <t:${unix}:R>`,
    `🎯 **Wyniki meczów:** Osobny deadline dla każdego meczu.`,
  ].join("\n");
}

function stripOldDeadlineLines(description = "") {
  return String(description)
    .split("\n")
    .filter((line) => {
      const l = line.toLowerCase();

      return (
        !l.includes("deadline:") &&
        !l.includes("deadline typowania") &&
        !l.includes("pozostało:") &&
        !l.includes("pozostalo:") &&
        !l.includes("deadline za") &&
        !l.includes("wyniki meczów:") &&
        !l.includes("wyniki meczow:") &&
        !l.includes("osobny deadline") &&
        !line.includes("⏰") &&
        !line.includes("⏳") &&
        !line.includes("🕒")
      );
    })
    .join("\n")
    .trim();
}

async function safeEnsureDeadlineDescription(message, baseEmbed, deadline) {
  try {
    if (!message || typeof message.edit !== "function") {
      return;
    }

    const oldDescription = baseEmbed?.data?.description || "";

    const cleanedDescription = stripOldDeadlineLines(oldDescription);

    const deadlineLines = buildDeadlineLines(deadline);

    const newDescription = cleanedDescription
      ? `${cleanedDescription}\n\n${deadlineLines}`
      : deadlineLines;

    if (oldDescription === newDescription) {
      return;
    }

    const updated = EmbedBuilder.from(
      baseEmbed || new EmbedBuilder(),
    ).setDescription(newDescription);

    await message.edit({
      embeds: [updated],
    });

    console.log("[DEADLINE] panel description updated");
  } catch (err) {
    logWarn("deadline", "safeEnsureDeadlineDescription failed", {
      message: err.message,
    });

    console.error("[DEADLINE] safeEnsureDeadlineDescription failed", err);
  }
}

async function canPingEveryone(channel) {
  try {
    const me =
      channel.guild.members.me ||
      (await channel.guild.members.fetchMe().catch(() => null));

    if (!me) {
      return false;
    }

    return !!channel
      .permissionsFor(me)
      ?.has(PermissionFlagsBits.MentionEveryone);
  } catch (err) {
    console.error("[DEADLINE] canPingEveryone failed", err);

    return false;
  }
}

function startDeadlineReminder(client, guildId) {
  if (!guildId) {
    logError("deadline", "startDeadlineReminder called without guildId");

    console.error("[DEADLINE] startDeadlineReminder called without guildId");

    return;
  }

  const guildKey = String(guildId);

  if (_startedReminders.has(guildKey)) {
    logWarn("deadline", "Deadline reminder already running for guild", {
      guildId,
    });

    console.log("[DEADLINE] reminder already running", {
      guildId,
    });

    return;
  }

  _startedReminders.add(guildKey);

  console.log("[DEADLINE] reminder started", {
    guildId,
  });

  setInterval(async () => {
    // ==================================================
    // OCHRONA PRZED RÓWNOLEGŁYM TICKIEM
    // ==================================================

    if (_runningGuilds.has(guildKey)) {
      logWarn(
        "deadline",
        "Deadline reminder tick skipped - previous tick still running",
        {
          guildId,
        },
      );

      return;
    }

    _runningGuilds.add(guildKey);

    try {
      await withGuild(guildId, async ({ pool }) => {
        const [panels] = await pool.query(
          `
              SELECT
                id,
                phase,
                stage,
                stage_key,
                channel_id,
                message_id,
                deadline,
                reminded
              FROM active_panels
              WHERE active = 1
                AND closed = 0
                AND deadline IS NOT NULL
                AND guild_id = ?
              `,
          [guildId],
        );

        if (!panels.length) {
          if (_deadlineIdleState.get(guildKey) !== "idle") {
            _deadlineIdleState.set(guildKey, "idle");

            logInfo("deadline", "Deadline reminder idle - no active panels", {
              guildId,
            });

            console.log("[DEADLINE] idle - no active panels", {
              guildId,
            });
          }

          return;
        }

        console.log("[DEADLINE] panels fetched", {
          guildId,
          count: panels.length,
        });

        if (_deadlineIdleState.get(guildKey) !== "active") {
          _deadlineIdleState.set(guildKey, "active");

          logInfo("deadline", "Deadline reminder active panels found", {
            guildId,
            count: panels.length,
          });

          console.log("[DEADLINE] active panels found", {
            guildId,
            count: panels.length,
          });
        }

        for (const panel of panels) {
          const {
            id,
            phase,
            stage,
            stage_key,
            channel_id,
            message_id,
            deadline,
            reminded = 0,
          } = panel;

          console.log("[DEADLINE] checking panel", {
            guildId,
            panelId: id,
            phase,
            stage,
            stage_key,
            channel_id,
            message_id,
            deadline,
            reminded,
          });

          if (!deadline) {
            console.log("[DEADLINE] skipped - no deadline", {
              panelId: id,
            });

            continue;
          }

          const nowUtc = DateTime.utc();

          const deadlineUtc = DateTime.fromJSDate(
            deadline instanceof Date ? deadline : new Date(deadline),
          ).toUTC();

          const diffInMinutes = deadlineUtc.diff(nowUtc, "minutes").minutes;

          const oldEnough = isMessageOlderThan(message_id, 1);

          console.log("[DEADLINE] diff calculated", {
            guildId,
            panelId: id,
            nowUtc: nowUtc.toISO(),
            deadlineUtc: deadlineUtc.toISO(),
            diffInMinutes,
            reminded,
            oldEnough,
          });

          const channel = await client.channels
            .fetch(channel_id)
            .catch((err) => {
              console.error("[DEADLINE] channel fetch failed", {
                channel_id,

                error: err.message,
              });

              return null;
            });

          if (!channel) {
            console.log("[DEADLINE] skipped - channel not found", {
              panelId: id,
              channel_id,
            });

            continue;
          }

          const message = await channel.messages
            .fetch(message_id)
            .catch((err) => {
              console.error("[DEADLINE] message fetch failed", {
                message_id,

                error: err.message,
              });

              return null;
            });

          if (!message) {
            console.log("[DEADLINE] skipped - message not found", {
              panelId: id,
              message_id,
            });

            continue;
          }

          const baseEmbed = message.embeds?.[0]
            ? EmbedBuilder.from(message.embeds[0])
            : new EmbedBuilder();

          await safeEnsureDeadlineDescription(message, baseEmbed, deadline);

          if (diffInMinutes <= 0) {
            console.log("[DEADLINE] skipped - deadline already passed", {
              panelId: id,
              diffInMinutes,
            });

            continue;
          }

          console.log("[DEADLINE] reminder condition check", {
            guildId,
            panelId: id,
            diffInMinutes,
            reminded,
            oldEnough,

            shouldSend:
              diffInMinutes <= 60 && Number(reminded) === 0 && oldEnough,
          });

          if (diffInMinutes <= 60 && Number(reminded) === 0 && oldEnough) {
            const stageLabel = stage_key || stage || null;

            const canMentionEveryone = await canPingEveryone(channel);

            const pingText = canMentionEveryone ? "@everyone\n\n" : "";

            const content =
              `${pingText}` +
              `⏰ **Przypomnienie o typowaniu!**\n` +
              `Faza: **${phase}${
                stageLabel ? ` – ${String(stageLabel).toUpperCase()}` : ""
              }**\n` +
              `Została mniej niż **1 godzina** do zakończenia typowania.\n\n` +
              `⏳ Deadline: <t:${Math.floor(
                new Date(deadline).getTime() / 1000,
              )}:R>`;

            console.log("[DEADLINE] sending reminder", {
              guildId,
              panelId: id,
              channelId: channel_id,
              canMentionEveryone,
            });

            try {
              await channel.send({
                content,

                allowedMentions: canMentionEveryone
                  ? {
                      parse: ["everyone"],
                    }
                  : {
                      parse: [],
                    },
              });

              console.log("[DEADLINE] reminder sent successfully", {
                guildId,
                panelId: id,
              });
            } catch (err) {
              console.error("[DEADLINE] SEND FAILED", {
                guildId,
                panelId: id,

                channelId: channel_id,

                message: err.message,

                stack: err.stack,
              });

              continue;
            }

            await pool.query(
              `
                UPDATE active_panels
                SET reminded = 1
                WHERE id = ?
                  AND guild_id = ?
                `,
              [id, guildId],
            );

            console.log("[DEADLINE] reminded updated", {
              guildId,
              panelId: id,
            });

            logInfo("deadline", "Deadline reminder sent", {
              guildId,
              panelId: id,
              phase,
              stage,
              stage_key,

              channelId: channel_id,

              messageId: message_id,

              canMentionEveryone,
            });
          }
        }
      });
    } catch (err) {
      logError("deadline", "Deadline reminder error", {
        guildId,
        message: err.message,
        stack: err.stack,
      });

      console.error("[DEADLINE] reminder error", {
        guildId,

        message: err.message,

        stack: err.stack,
      });
    } finally {
      // ==================================================
      // ZAWSZE ZWALNIAMY BLOKADĘ
      // ==================================================

      _runningGuilds.delete(guildKey);
    }
  }, 60 * 1000);
}

module.exports = {
  startDeadlineReminder,
};
