// utils/sendPredictionEmbeds.js
const { EmbedBuilder, ChannelType } = require('discord.js');
const { getGuildConfig } = require('./guildRegistry');
const logger = require('./logger');

/**
 * OBSŁUGA:
 * - sendPredictionEmbed(client, type, userId, data)  ❌ DEPRECATED
 * - sendPredictionEmbed(client, guildId, type, userId, data) ✅
 */
module.exports = async function sendPredictionEmbed(client, a, b, c, d) {
  let guildId, typeIn, userId, data;

  // ---- normalize args
  if (typeof a === 'string' && typeof b === 'string' && typeof c === 'string') {
    guildId = a;
    typeIn = b;
    userId = c;
    data = d || {};
  } else {
    logger.warn(
      'prediction_embed',
      'Deprecated call without guildId – embed NOT sent',
      { args: [a, b, c] }
    );
    return;
  }

  if (!guildId || !typeIn || !userId) {
    logger.warn('prediction_embed', 'Missing required params', {
      guildId,
      typeIn,
      userId,
    });
    return;
  }

  const typeRaw = String(typeIn).toLowerCase();
  const type =
    typeRaw.startsWith('swiss') ? 'swiss'
      : typeRaw.startsWith('double') ? 'double'
      : typeRaw === 'playoffs' ? 'playoffs'
      : typeRaw === 'playin' ? 'playin'
      : null;

  if (!type) {
    logger.warn('prediction_embed', 'Unknown prediction type', {
      guildId,
      typeIn,
    });
    return;
  }

  const cfg = getGuildConfig(guildId);
  if (!cfg) {
    logger.warn('prediction_embed', 'Missing guild config', { guildId });
    return;
  }

  // ---- channel resolve
  const channelId =
    type === 'swiss'
      ? (cfg.SWISS_PREDICTIONS_CHANNEL_ID || cfg.PREDICTIONS_CHANNEL_ID)
      : cfg.PREDICTIONS_CHANNEL_ID;

  if (!channelId) {
    logger.warn('prediction_embed', 'No channel configured', { guildId, type });
    return;
  }

  // ---- resolve displayName
  let displayName = 'Unknown';
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    displayName = member.displayName || member.user.username;
  } catch {
    try {
      const user = await client.users.fetch(userId);
      displayName = user.username;
    } catch {}
  }

  const mention = `<@${userId}>`;
  const toStr = (v) =>
    Array.isArray(v) ? (v.length ? v.join(', ') : '—')
      : v == null || String(v).trim() === '' ? '—'
      : String(v);

  const embed = new EmbedBuilder()
    .setTimestamp()
    .addFields({ name: 'Typujący', value: `${displayName} – ${mention}` });

  // ---- build embed per type
  if (type === 'swiss') {
    embed
      .setColor(0x3366ff)
      .setTitle('🔄 Nowe typy – Swiss')
      .addFields(
        { name: '🔥 3-0', value: toStr(data.pick_3_0), inline: true },
        { name: '💀 0-3', value: toStr(data.pick_0_3), inline: true },
        { name: '🚀 Awansujące', value: toStr(data.advancing), inline: false },
      );
  }

  if (type === 'playoffs') {
    embed
      .setColor(0x00ff99)
      .setTitle('🎯 Nowe typy – Playoffs')
      .addFields(
        { name: '🏆 Półfinaliści', value: toStr(data.semifinalists) },
        { name: '🥈 Finaliści', value: toStr(data.finalists) },
        { name: '🥇 Zwycięzca', value: toStr(data.winner), inline: true },
        { name: '🥉 3. miejsce', value: toStr(data.third_place_winner), inline: true },
      );
  }

  if (type === 'double') {
    embed
      .setColor(0xff6600)
      .setTitle('⚔️ Nowe typy – Double Elimination')
      .addFields(
        { name: 'Upper A', value: toStr(data.upper_final_a), inline: true },
        { name: 'Lower A', value: toStr(data.lower_final_a), inline: true },
        { name: 'Upper B', value: toStr(data.upper_final_b), inline: true },
        { name: 'Lower B', value: toStr(data.lower_final_b), inline: true },
      );
  }

  if (type === 'playin') {
    embed
      .setColor(0x0099ff)
      .setTitle('🎯 Nowe typy – Play-In')
      .addFields({
        name: 'Drużyny awansujące',
        value: toStr(data.teams),
      });
  }

  // ---- send
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error('Invalid channel type');
    }

    await channel.send({ embeds: [embed] });
    logger.info('prediction_embed', 'Embed sent', {
      guildId,
      type,
      channelId,
      userId,
    });
  } catch (err) {
    logger.error('prediction_embed', 'Failed to send embed', {
      guildId,
      channelId,
      message: err.message,
    });
  }
};
