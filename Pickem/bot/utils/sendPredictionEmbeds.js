// utils/sendPredictionEmbed.js
const { EmbedBuilder } = require('discord.js');

module.exports = async function sendPredictionEmbed(client, typeIn, userId, data = {}) {
  console.log(`📤 [sendPredictionEmbed] start type=${typeIn} user=${userId} data=`, JSON.stringify(data));

  // 1) Normalizacja typu
  const typeRaw = String(typeIn || '').toLowerCase();

  // Swiss: zaakceptuj wszystko zaczynające się od "swiss"
  const isSwiss = typeRaw.startsWith('swiss');
  let normalizedType;

  if (isSwiss) {
    normalizedType = 'swiss';
  } else if (typeRaw === 'playoffs' || typeRaw === 'playoff') {
    normalizedType = 'playoffs';
  } else if (typeRaw === 'double' || typeRaw === 'doubleelim' || typeRaw === 'double_elim') {
    normalizedType = 'double';
  } else if (typeRaw === 'playin' || typeRaw === 'play-in') {
    normalizedType = 'playin';
  } else {
    normalizedType = typeRaw;
  }

  const type = normalizedType;
  console.log(`🔍 [sendPredictionEmbed] typeRaw='${typeRaw}' normalized='${type}'`);

  // 2) Kanał – jak wcześniej
  const channelId =
    process.env.LOG_CHANNEL_ID ||
    process.env.EXPORT_CHANNEL_ID ||
    '1387843207832010884';
  console.log(`🆔 [sendPredictionEmbed] channelId=${channelId}`);

  // 3) Nazwa wyświetlana
  let displayName = 'Unknown';
  let mention = `<@${userId}>`;

  try {
    const guildId = process.env.GUILD_ID;
    if (!guildId) throw new Error('Brak GUILD_ID w env');
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    displayName = member.displayName || member.user.username;
  } catch (err) {
    console.warn(`⚠️ [sendPredictionEmbed] member fetch warn: ${err.message}`);
    try {
      const user = await client.users.fetch(userId);
      displayName = user.username || displayName;
    } catch (_) {}
  }

  const typujacyField = `${displayName} - ${mention}`;
  const embed = new EmbedBuilder().setColor('#cccccc').setTimestamp();

  // Pomocnik: zamień tablice na string
  const toStr = (v) => {
    if (Array.isArray(v)) return v.join(', ');
    if (v == null) return '—';
    const s = String(v).trim();
    return s.length ? s : '—';
  };

  // ===== SWISS =====
  if (type === 'swiss') {
    // 4) Ustal stage:

    // a) Najpierw z data.stage, jeśli podane
    let stageRaw = data.stage ? String(data.stage).toLowerCase() : null;

    // b) Jeżeli brak w data, spróbuj wyciągnąć z typeRaw
    if (!stageRaw) {
      // np. "swiss_stage_1", "swiss1", "swiss_stage1", "swiss_stage-2"
      const m = typeRaw.match(/stage[_-]?(\d)/) || typeRaw.match(/swiss[_-]?(\d)/);
      if (m && m[1]) {
        stageRaw = `stage_${m[1]}`;
      }
    }

    // c) Ładny label do tytułu
    let stageLabel = '';
    if (stageRaw) {
      const numMatch = stageRaw.match(/(\d)/);
      if (numMatch && numMatch[1]) {
        stageLabel = ` – Stage ${numMatch[1]}`;
      } else {
        stageLabel = ` – ${stageRaw.toUpperCase()}`;
      }
    }

    // 5) Zbierz dane z różnych możliwych kluczy
    const pick3_0 = data.pick3_0 || data.threeZero || data['3_0'] || data['3-0'] || data['3'] || [];
    const pick0_3 = data.pick0_3 || data.zeroThree || data['0_3'] || data['0-3'] || data['0'] || [];
    const advancing = data.advancing || data.advance || data.awans || data.adv || [];

    embed
      .setColor('#3366ff')
      .setTitle(`🔄 Nowe typy na fazę Swiss${stageLabel}!`)
      .addFields(
        { name: 'Typujący', value: typujacyField },
        { name: '🔥 3-0', value: toStr(pick3_0), inline: true },
        { name: '💀 0-3', value: toStr(pick0_3), inline: true },
        { name: '🚀 Awansujące', value: toStr(advancing), inline: false }
      );

  // ===== PLAYOFFS =====
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

  // ===== DOUBLE ELIM =====
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

  // ===== PLAY-IN =====
  } else if (type === 'playin') {
    embed
      .setColor('#0099ff')
      .setTitle('🎯 Nowe typy na fazę Play-In!')
      .addFields(
        { name: 'Typujący', value: typujacyField },
        { name: 'Drużyny awansujące z Play-In', value: toStr(data.teams), inline: false }
      );

  // ===== NIEZNANY TYP =====
  } else {
    console.warn(`⚠️ [sendPredictionEmbed] Nieznany type='${typeIn}' (po normalizacji='${type}') – przerwano.`);
    return;
  }

  // LOG EMBED TREŚCI
  console.log('📦 [sendPredictionEmbed] embed=', embed.data);

  // 6) Pobierz kanał
  let channel;
  try {
    channel = await client.channels.fetch(channelId);
    if (!channel) throw new Error('Kanał nie istnieje lub brak dostępu');
    console.log(`📡 [sendPredictionEmbed] channel ok: ${channel.id}`);
  } catch (err) {
    console.error(`❌ [sendPredictionEmbed] channel fetch error: ${err.message}`);
    return;
  }

  // 7) Wyślij embed
  try {
    await channel.send({ embeds: [embed] });
    console.log('✅ [sendPredictionEmbed] wysłano');
  } catch (err) {
    console.error(`❌ [sendPredictionEmbed] send error: ${err.message}`);
  }
};
