// utils/sendPredictionEmbed.js
const { EmbedBuilder } = require('discord.js');

module.exports = async function sendPredictionEmbed(client, typeIn, userId, data = {}) {
  console.log('================= 📤 sendPredictionEmbed START =================');
  console.log(`➡️ typeIn =`, typeIn);
  console.log(`➡️ userId =`, userId);
  console.log(`➡️ data   =`, JSON.stringify(data));

  console.log('[ENV] LOG_CHANNEL_ID     =', process.env.LOG_CHANNEL_ID || '(brak)');
  console.log('[ENV] EXPORT_CHANNEL_ID  =', process.env.EXPORT_CHANNEL_ID || '(brak)');
  console.log('[ENV] GUILD_ID           =', process.env.GUILD_ID || '(brak)');

  // 1) Normalizacja typu (obsłuż m.in. 'swiss_stage_1')
  const typeRaw = String(typeIn || '').toLowerCase();
  const isSwiss = typeRaw === 'swiss' || typeRaw.startsWith('swiss_stage_');
  const type = isSwiss ? 'swiss' : typeRaw;

  console.log(`🔍 Po normalizacji: isSwiss=${isSwiss}, type='${type}', typeRaw='${typeRaw}'`);

  // 2) Kanał – dla Swiss na sztywno kierujemy na kanał z typami
  const SWISS_CHANNEL_HARDCODE = '1387843207832010884'; // <- Twój kanał z typami

  let channelId;
  if (type === 'swiss') {
    channelId =
      process.env.SWISS_PREDICTIONS_CHANNEL_ID || // jak kiedyś dodasz osobne env
      process.env.EXPORT_CHANNEL_ID ||            // ewentualnie wspólny eksport
      SWISS_CHANNEL_HARDCODE;                     // ostateczny fallback (Twój kanał)
    console.log(`🆔 [sendPredictionEmbed] WYBRANO kanał dla SWISS = ${channelId}`);
  } else {
    channelId =
      process.env.LOG_CHANNEL_ID ||
      process.env.EXPORT_CHANNEL_ID ||
      SWISS_CHANNEL_HARDCODE;
    console.log(`🆔 [sendPredictionEmbed] WYBRANO kanał type='${type}' = ${channelId}`);
  }

  // 3) Spróbuj pobrać displayName – nie blokuje wysyłki w razie błędu
  let displayName = 'Unknown';
  let mention = `<@${userId}>`;

  try {
    const guildId = process.env.GUILD_ID;
    if (!guildId) throw new Error('Brak GUILD_ID w env');
    console.log(`[sendPredictionEmbed] Fetch guild ${guildId}`);
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    displayName = member.displayName || member.user.username;
    console.log(`[sendPredictionEmbed] displayName OK = ${displayName}`);
  } catch (err) {
    console.warn(`⚠️ [sendPredictionEmbed] member fetch warn: ${err.message}`);
    // awaryjnie spróbuj usera globalnie
    try {
      const user = await client.users.fetch(userId);
      displayName = user.username || displayName;
      console.log(`[sendPredictionEmbed] fallback displayName = ${displayName}`);
    } catch (err2) {
      console.warn(`⚠️ [sendPredictionEmbed] global user fetch fail: ${err2.message}`);
    }
  }

  const typujacyField = `${displayName} - ${mention}`;
  const embed = new EmbedBuilder().setColor('#cccccc').setTimestamp();

  // Helper do pól
  const toStr = (v) => {
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    if (v == null) return '—';
    const s = String(v).trim();
    return s.length ? s : '—';
  };

  if (type === 'swiss') {
    // 4) Ustal stage (z data.stage lub z sufiksu typu)
    let stage =
      (data.stage && String(data.stage)) ||
      (typeRaw.startsWith('swiss_stage_')
        ? typeRaw.replace('swiss_stage_', 'stage_')
        : null);

    console.log(`[sendPredictionEmbed] SWISS stage =`, stage);

    // 5) Zbierz dane z różnych możliwych kluczy
    const pick3_0 =
      data.pick3_0 ||
      data.threeZero ||
      data['3_0'] ||
      data['3-0'] ||
      [];
    const pick0_3 =
      data.pick0_3 ||
      data.zeroThree ||
      data['0_3'] ||
      data['0-3'] ||
      [];
    const advancing =
      data.advancing ||
      data.advance ||
      data.awans ||
      [];

    console.log('[sendPredictionEmbed] SWISS picks:');
    console.log('  🔥 3-0        =', pick3_0);
    console.log('  💀 0-3        =', pick0_3);
    console.log('  🚀 advancing  =', advancing);

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
    console.warn(`⚠️ [sendPredictionEmbed] Nieznany type='${typeIn}' (po normalizacji='${type}') – przerwano.`);
    console.log('================= 📤 sendPredictionEmbed END (UNKNOWN TYPE) =================');
    return;
  }

  // LOG EMBED TREŚCI
  console.log('📦 [sendPredictionEmbed] embed.data =', JSON.stringify(embed.data, null, 2));

  let channel;
  try {
    console.log(`[sendPredictionEmbed] Fetch channel ${channelId}`);
    channel = await client.channels.fetch(channelId);
    if (!channel) throw new Error('Kanał nie istnieje lub brak dostępu');
    console.log(`📡 [sendPredictionEmbed] channel OK: ${channel.id} (${channel.type})`);
  } catch (err) {
    console.error(`❌ [sendPredictionEmbed] channel fetch error: ${err.message}`);
    console.log('================= 📤 sendPredictionEmbed END (CHANNEL FAIL) =================');
    return;
  }

  try {
    await channel.send({ embeds: [embed] });
    console.log('✅ [sendPredictionEmbed] wysłano embed na kanał', channel.id);
  } catch (err) {
    console.error(`❌ [sendPredictionEmbed] send error: ${err.message}`);
  }

  console.log('================= 📤 sendPredictionEmbed END (OK) =================');
};
