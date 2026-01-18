// handlers/deadlineReminder.js
const pool = require('../db.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DateTime } = require('luxon');
const logger = require('../utils/logger.js');

function formatLeft(deadlineUtc, nowUtc) {
  const diff = deadlineUtc.diff(nowUtc, ['days', 'hours', 'minutes']).toObject();
  let d = Math.max(0, Math.floor(diff.days || 0));
  let h = Math.max(0, Math.floor(diff.hours || 0));
  let m = Math.max(0, Math.ceil(diff.minutes || 0)); // zaokrąglaj w górę

  const parts = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  parts.push(`${Math.max(1, m)} min`);
  return parts.join(' ');
}

async function safeEditFooter(message, baseEmbed, footerText) {
  const currentFooter = baseEmbed?.data?.footer?.text || '';
  if (currentFooter === footerText) return; // nic się nie zmienia — oszczędzamy edycję

  const updated = EmbedBuilder.from(baseEmbed || new EmbedBuilder()).setFooter({ text: footerText });
  await message.edit({ embeds: [updated] });
}

async function disableAllButtons(message, baseEmbed) {
  try {
    const newComponents = (message.components || []).map((row) => {
      const r = ActionRowBuilder.from(row);
      r.components = r.components.map((c) => {
        try {
          return ButtonBuilder.from(c).setDisabled(true);
        } catch {
          // jeśli to nie button (np. select) - zostaw jak jest
          return c;
        }
      });
      return r;
    });

    // Jeżeli nie było żadnych komponentów – wstaw jeden wyłączony
    if (!newComponents.length) {
      newComponents.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('disabled_button')
            .setLabel('Typowanie zamknięte')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
      );
    }

    const closedEmbed = EmbedBuilder.from(baseEmbed || new EmbedBuilder()).setFooter({ text: '🔒 Typowanie zamknięte' });
    await message.edit({ embeds: [closedEmbed], components: newComponents });
  } catch (e) {
    logger.error('deadline', 'disableAllButtons failed', { message: e.message, stack: e.stack });

    // awaryjnie — prosty jeden wiersz
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('disabled_button')
        .setLabel('Typowanie zamknięte')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    const closedEmbed = EmbedBuilder.from(baseEmbed || new EmbedBuilder()).setFooter({ text: '🔒 Typowanie zamknięte' });
    await message.edit({ embeds: [closedEmbed], components: [disabledRow] });
  }
}

function startDeadlineReminder(client, guildId) {
  if (!guildId) {
    logger.error('deadline', 'startDeadlineReminder called without guildId');
    return;
  }

  const { withGuild } = require('../utils/guildContext');

  setInterval(async () => {
    try {
      // ✅ Użyj withGuild aby zapewnić właściwy kontekst bazy danych
      await withGuild(guildId, async () => {
        const [panels] = await pool.query(
          `SELECT phase, stage, channel_id, message_id, deadline, reminded
           FROM active_panels
           WHERE active = 1
             AND deadline IS NOT NULL`
        );

        for (const panel of panels) {
          const { phase, stage, channel_id, message_id, deadline, reminded = 0 } = panel;
          if (!deadline) continue;

          // Liczymy w UTC (prościej i spójnie z DB)
          const nowUtc = DateTime.utc();
          const deadlineUtc = DateTime.fromJSDate(deadline).toUTC();
          const diffInMinutes = deadlineUtc.diff(nowUtc, 'minutes').minutes;
          if (diffInMinutes <= 0) continue;

          // Pobierz kanał i wiadomość z panelem
          const channel = await client.channels.fetch(channel_id).catch((err) => {
            logger.error('deadline', 'Fetch channel failed', { channel_id, message: err.message });
            return null;
          });
          if (!channel) continue;

          const message = await channel.messages.fetch(message_id).catch((err) => {
            logger.error('deadline', 'Fetch message failed', { message_id, channel_id, message: err.message });
            return null;
          });
          if (!message) continue;

          const baseEmbed = message.embeds?.[0] ? EmbedBuilder.from(message.embeds[0]) : new EmbedBuilder();

          // 🔄 Odśwież footer z countdownem, jeśli jeszcze przed deadlinem
          if (diffInMinutes > 0) {
            const left = formatLeft(deadlineUtc, nowUtc);
            const newFooter = `🕒 Deadline za ${left || 'mniej niż minutę'}`;
            await safeEditFooter(message, baseEmbed, newFooter);
          }

          // 🔔 Przypomnienie (≤ 60 min przed końcem, jednorazowe)
          if (diffInMinutes <= 60 && diffInMinutes > 0 && reminded === 0) {
            const embed = new EmbedBuilder()
              .setColor('Orange')
              .setTitle(`⏰ Przypomnienie o typowaniu (${phase}${stage ? ` – ${String(stage).toUpperCase()}` : ''})`)
              .setDescription(`Została mniej niż 1 godzina do zakończenia typowania!\nNie zapomnij oddać swoich typów.`)
              .setTimestamp();

            await channel.send({
              embeds: [embed],
              // content: '@everyone',
              // allowedMentions: { parse: ['everyone'] }
            });

            let updateReminderQuery = `UPDATE active_panels SET reminded = 1 WHERE phase = ? AND channel_id = ?`;
            const reminderParams = [phase, channel_id];
            if (stage !== null && stage !== undefined) {
              updateReminderQuery += ` AND stage = ?`;
              reminderParams.push(stage);
            } else {
              updateReminderQuery += ` AND stage IS NULL`;
            }
            await pool.query(updateReminderQuery, reminderParams);
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
