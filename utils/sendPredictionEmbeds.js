// utils/sendPredictionEmbeds.js
const { EmbedBuilder } = require('discord.js');
const { getGuildConfig, getAllGuildIds } = require('./guildRegistry');
const logger = require('./logger');

/**
 * Backward compatible:
 * - old: sendPredictionEmbed(client, typeIn, userId, data)
 * - new: sendPredictionEmbed(client, guildId, typeIn, userId, data)
 */
module.exports = async function sendPredictionEmbed(client, a, b, c, d) {
  let guildId, typeIn, userId, data;

  const knownTypes = new Set(['swiss', 'playoffs', 'double', 'playin']);
  const aNorm = String(a || '').toLowerCase();

  if (knownTypes.has(aNorm) || aNorm.startsWith('swiss_stage_')) {
    // old signature
    guildId = d?.guildId ? String(d.guildId) : null;
    typeIn = a;
    userId = b;
    data = c || {};
  } else {
    // new signature
    guildId = a ? String(a) : null;
    typeIn = b;
    userId = c;
    data = d || {};
  }

  const typeRaw = String(typeIn || '').toLowerCase();
  const isSwiss = typeRaw === 'swiss' || typeRaw.startsWith('swiss_stage_');
  const type = isSwiss ? 'swiss' : typeRaw;

  // --- resolve guildId safely
  if (!guildId) {
    // jeśli jest dokładnie 1 guild w konfiguracji, można bezpiecznie zgadnąć
    const ids = getAllGuildIds();
    if (ids.length === 1) {
      guildId = ids[0];
    } else {
      logger.warn('prediction_embed', 'Brak guildId – pomijam wysyłkę embedów (żeby nie wysłać na zły serwer).', {
        type,
        userId,
        configuredGuilds: ids.length,
      });
      return;
    }
  }

  const cfg = getGuildConfig(guildId);
  if (!cfg) {
    logger.warn('prediction_embed', 'Brak configu dla guildId – pomijam embed.', { guildId, type, userId });
    return;
  }

  // --- channel selection (bez hardcode)
  const channelId =
    (type === 'swiss'
      ? (cfg.SWISS_PREDICTIONS_CHANNEL_ID || cfg.PREDICTIONS_CHANNEL_ID || cfg.EXPORT_PANEL_CHANNEL_ID || cfg.LOG_CHANNEL_ID)
      : (cfg.PREDICTIONS_CHANNEL_ID || cfg.LOG_CHANNEL_ID || cfg.EXPORT_PANEL_CHANNEL_ID));

  if (!channelId) {
    logger.warn('prediction_embed', 'Brak channelId w configu – nie mam gdzie wysłać embeda.', { guildId, type });
    return;
  }

  // --- get displayName (best effort)
  let displayName = 'Unknown';
  const mention = `<@${userId}>`;

  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    displayName = member.displayName || member.user.username;
  } catch (err) {
    try {
      const user = await client.users.fetch(userId);
      displayName = user.username || displayName;
    } catch (_) {}
  }

  const typujacyField = `${displayName} - ${mention}`;

  const toStr = (v) => {
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    if (v == null) return '—';
    const s = String(v).trim();
    return s.length ? s : '—';
  };

  const embed = new EmbedBuilder().setTimestamp();

  if (type === 'swiss') {
    let stage =
      (data.stage && String(data.stage)) ||
      (typeRaw.startsWith('swiss_stage_')
        ? typeRaw.replace('swiss_stage_', 'stage_')
        : null);

    const pick3_0 = data.pick3_0 || data.threeZero || data['3_0'] || data['3-0'] || [];
    const pick0_3 = data.pick0_3 || data.zeroThree || data['0_3'] || data['0-3'] || [];
    const advancing = data.advancing || data.advance || data.awans || [];

    embed
      .setColor('#3366ff')
      .setTitle(`🔄 Nowe typy na fazę Swiss${stage ? ` – ${String(stage).toUpperCase()}` : ''}!`)
      .addFields(
        { name: 'Typujący', value: typujacyField },
        { name: '🔥 3-0', value: toStr(pick3_0), inline: true },
        { name: '💀 0-3', value: toStr(pick0_3), inline: true },
        { name: '🚀 Awansujące', value: toStr(advancing), inline: false }
      );

  } else if (type === 'playoffs') {
    const semifinals = data.semis ?? data.semifinalists ?? [];
    const finals     = data.finals ?? data.finalists ?? [];
    const winner     = data.winner ?? '—';
    const third      = data.third ?? data.third_place_winner ?? '—';

    embed
      .setColor('#00ff99')
      .setTitle('🎯 Nowe typy na fazę Playoffs!')
      .addFields(
        { name: 'Typujący', value: typujacyField },
        { name: '🏆 Półfinaliści', value: toStr(semifinals), inline: false },
        { name: '🥈 Finaliści', value: toStr(finals), inline: false },
        { name: '🥇 Zwycięzca', value: toStr(winner), inline: true },
        { name: '🥉 3. miejsce', value: toStr(third), inline: true }
      );

  } else if (type === 'double') {
    embed
      .setColor('#ff6600')
      .setTitle('⚔️ Nowe typy na fazę Double Elimination!')
      .addFields(
        { name: 'Typujący', value: typujacyField },
        { name: '🔵 Upper Final A', value: toStr(data.ua), inline: true },
        { name: '🔵 Upper Final B', value: toStr(data.ub), inline: true },
        { name: '🔴 Lower Final A', value: toStr(data.la), inline: true },
        { name: '🔴 Lower Final B', value: toStr(data.lb), inline: true }
      );

  } else if (type === 'playin') {
    embed
      .setColor('#0099ff')
      .setTitle('🎯 Nowe typy na fazę Play-In!')
      .addFields(
        { name: 'Typujący', value: typujacyField },
        { name: 'Drużyny awansujące z Play-In', value: toStr(data.teams), inline: false }
      );

  } else {
    logger.warn('prediction_embed', 'Nieznany typ embeda – pomijam.', { guildId, typeIn, userId });
    return;
  }

  try {
    const channel = await client.channels.fetch(String(channelId));
    if (!channel) throw new Error('Kanał nie istnieje / brak dostępu');

    await channel.send({ embeds: [embed] });
    logger.info('prediction_embed', 'Wysłano embed z typami', { guildId, type, channelId: String(channelId), userId });
  } catch (err) {
    logger.error('prediction_embed', 'Nie udało się wysłać embeda', {
      guildId,
      type,
      channelId: String(channelId),
      message: err.message,
    });
  }
};
