// handlers/deadlineReminder.js
const {
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const { DateTime } = require('luxon');
const { logInfo, logWarn, logError } = require('../utils/logger.js');
const { withGuild } = require('../utils/guildContext');

const _startedReminders = new Set();

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
  const deadlineDate = deadline instanceof Date
    ? deadline
    : new Date(deadline);

  const unix = Math.floor(deadlineDate.getTime() / 1000);

  return [
    `⏰ Deadline: <t:${unix}:F>`,
    `⏳ Pozostało: <t:${unix}:R>`
  ].join('\n');
}

function stripOldDeadlineLines(description = '') {
  return String(description)
    .split('\n')
    .filter(line => {
      const l = line.toLowerCase();

      return (
        !l.includes('deadline:') &&
        !l.includes('pozostało:') &&
        !l.includes('pozostalo:') &&
        !l.includes('deadline za') &&
        !line.includes('⏰') &&
        !line.includes('⏳') &&
        !line.includes('🕒')
      );
    })
    .join('\n')
    .trim();
}

async function safeEnsureDeadlineDescription(message, baseEmbed, deadline) {
  try {
    if (!message || typeof message.edit !== 'function') return;

    const oldDescription =
      baseEmbed?.data?.description ||
      '';

    const cleanedDescription =
      stripOldDeadlineLines(oldDescription);

    const deadlineLines =
      buildDeadlineLines(deadline);

    const newDescription = cleanedDescription
      ? `${cleanedDescription}\n\n${deadlineLines}`
      : deadlineLines;

    if (oldDescription === newDescription) {
      return;
    }

    const updated = EmbedBuilder
      .from(baseEmbed || new EmbedBuilder())
      .setDescription(newDescription);

    await message.edit({
      embeds: [updated]
    });
  } catch (err) {
    logWarn('deadline', 'safeEnsureDeadlineDescription failed', {
      message: err.message
    });
  }
}

function startDeadlineReminder(client, guildId) {
  if (!guildId) {
    logError('deadline', 'startDeadlineReminder called without guildId');
    return;
  }

  if (_startedReminders.has(String(guildId))) {
    logWarn('deadline', 'Deadline reminder already running for guild', {
      guildId
    });
    return;
  }

  _startedReminders.add(String(guildId));

  setInterval(async () => {
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
            AND deadline IS NOT NULL
            AND guild_id = ?
          `,
          [guildId]
        );

        for (const panel of panels) {
          const {
            id,
            phase,
            stage,
            stage_key,
            channel_id,
            message_id,
            deadline,
            reminded = 0
          } = panel;

          if (!deadline) continue;

          const nowUtc = DateTime.utc();
          const deadlineUtc = DateTime.fromJSDate(
            deadline instanceof Date ? deadline : new Date(deadline)
          ).toUTC();

          const diffInMinutes =
            deadlineUtc.diff(nowUtc, 'minutes').minutes;

          const channel = await client.channels
            .fetch(channel_id)
            .catch(() => null);

          if (!channel) continue;

          const message = await channel.messages
            .fetch(message_id)
            .catch(() => null);

          if (!message) continue;

          const baseEmbed = message.embeds?.[0]
            ? EmbedBuilder.from(message.embeds[0])
            : new EmbedBuilder();

          await safeEnsureDeadlineDescription(
            message,
            baseEmbed,
            deadline
          );

          if (diffInMinutes <= 0) {
            continue;
          }

          if (
            diffInMinutes <= 60 &&
            reminded === 0 &&
            isMessageOlderThan(message_id, 1)
          ) {
            const stageLabel =
              stage_key ||
              stage ||
              null;

            const embed = new EmbedBuilder()
              .setColor('Orange')
              .setTitle(
                `⏰ Przypomnienie o typowaniu (${phase}${stageLabel ? ` – ${String(stageLabel).toUpperCase()}` : ''})`
              )
              .setDescription(
                'Została mniej niż 1 godzina do zakończenia typowania!'
              )
              .setTimestamp();

            const me = channel.guild.members.me;

            const canMentionEveryone = channel
              .permissionsFor(me)
              ?.has(PermissionFlagsBits.MentionEveryone);

            await channel.send({
              embeds: [embed],
              content: canMentionEveryone ? '@everyone' : undefined,
              allowedMentions: canMentionEveryone
                ? { parse: ['everyone'] }
                : { parse: [] }
            });

            await pool.query(
              `
              UPDATE active_panels
              SET reminded = 1
              WHERE id = ?
              `,
              [id]
            );

            logInfo('deadline', 'Deadline reminder sent', {
              guildId,
              panelId: id,
              phase,
              stage,
              stage_key,
              channelId: channel_id,
              messageId: message_id
            });
          }
        }
      });
    } catch (err) {
      logError('deadline', 'Deadline reminder error', {
        guildId,
        message: err.message,
        stack: err.stack
      });
    }
  }, 60 * 1000);
}

module.exports = {
  startDeadlineReminder
};