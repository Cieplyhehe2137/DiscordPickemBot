// handlers/deadlineReminder.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const { DateTime } = require('luxon');
const logger = require('../utils/logger.js');
const { withGuild } = require('../utils/guildContext');

const _startedReminders = new Set();

function formatLeft(deadlineUtc, nowUtc) {
  const diff = deadlineUtc.diff(nowUtc, ['days', 'hours', 'minutes']).toObject();
  let d = Math.max(0, Math.floor(diff.days || 0));
  let h = Math.max(0, Math.floor(diff.hours || 0));
  let m = Math.max(0, Math.ceil(diff.minutes || 0));

  const parts = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  parts.push(`${Math.max(1, m)} min`);
  return parts.join(' ');
}

function isMessageOlderThan(messageId, minutes = 1) {
  try {
    const DISCORD_EPOCH = 1420070400000n;
    const id = BigInt(messageId);
    const timestamp = Number((id >> 22n) + DISCORD_EPOCH);
    return Date.now() - timestamp > minutes * 60 * 1000;
  } catch {
    return true; // fail-open: lepiej nie blokować reminderów
  }
}



async function safeEditFooter(message, baseEmbed, footerText) {
  try {
    if (!message || typeof message.edit !== 'function') return;

    const currentFooter = baseEmbed?.data?.footer?.text || '';
    if (currentFooter === footerText) return;

    const updated = EmbedBuilder
      .from(baseEmbed || new EmbedBuilder())
      .setFooter({ text: footerText });

    await message.edit({ embeds: [updated] });
  } catch (err) {
    logger.warn('deadline', 'safeEditFooter failed', { message: err.message });
  }
}

function startDeadlineReminder(client, guildId) {
  if (!guildId) {
    logger.error('deadline', 'startDeadlineReminder called without guildId');
    return;
  }

  if (_startedReminders.has(String(guildId))) {
    logger.warn('deadline', 'Deadline reminder already running for guild', { guildId });
    return;
  }

  _startedReminders.add(String(guildId));

  setInterval(async () => {
    try {
      await withGuild(guildId, async ({ pool }) => {
        const [panels] = await pool.query(
          `
          SELECT phase, stage, channel_id, message_id, deadline, reminded
          FROM active_panels
          WHERE active = 1
            AND deadline IS NOT NULL
            AND guild_id = ?
          `,
          [guildId]
        );

        for (const panel of panels) {
          const { phase, stage, channel_id, message_id, deadline, reminded = 0 } = panel;
          if (!deadline) continue;

          const nowUtc = DateTime.utc();
          const deadlineUtc = DateTime.fromJSDate(deadline).toUTC();
          const diffInMinutes = deadlineUtc.diff(nowUtc, 'minutes').minutes;

          if (diffInMinutes <= 0) continue;

          const channel = await client.channels.fetch(channel_id).catch(() => null);
          if (!channel) continue;

          const message = await channel.messages.fetch(message_id).catch(() => null);
          if (!message) continue;

          const baseEmbed = message.embeds?.[0]
            ? EmbedBuilder.from(message.embeds[0])
            : new EmbedBuilder();

          const left = formatLeft(deadlineUtc, nowUtc);
          await safeEditFooter(
            message,
            baseEmbed,
            `🕒 Deadline za ${left || 'mniej niż minutę'}`
          );

          if (
            diffInMinutes <= 60 &&
            reminded === 0 &&
            isMessageOlderThan(message_id, 1)
          ) {
            const embed = new EmbedBuilder()
              .setColor('Orange')
              .setTitle(`⏰ Przypomnienie o typowaniu (${phase}${stage ? ` – ${String(stage).toUpperCase()}` : ''})`)
              .setDescription('Została mniej niż 1 godzina do zakończenia typowania!')
              .setTimestamp();

            const canMentionEveryone = channel
              .permissionsFor(channel.guild.members.me)
              ?.has(PermissionFlagsBits.MentionEveryone);

            await channel.send({
              embeds: [embed],
              content: canMentionEveryone ? '@everyone' : undefined,
              allowedMentions: canMentionEveryone ? { parse: ['everyone'] } : { parse: [] }
            });

            let updateSql = `
              UPDATE active_panels
              SET reminded = 1
              WHERE guild_id = ?
                AND phase = ?
                AND channel_id = ?
            `;
            const params = [guildId, phase, channel_id];

            if (stage !== null && stage !== undefined) {
              updateSql += ' AND stage = ?';
              params.push(stage);
            } else {
              updateSql += ' AND stage IS NULL';
            }

            await pool.query(updateSql, params);
          }
        }
      });
    } catch (err) {
      logger.error('deadline', 'Deadline reminder error', {
        guildId,
        message: err.message,
        stack: err.stack,
      });
    }
  }, 60 * 1000);
}

module.exports = { startDeadlineReminder };
