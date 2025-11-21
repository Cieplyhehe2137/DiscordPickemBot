// utils/autoStartPhase.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DateTime } = require('luxon');
const pool = require('../db.js');

module.exports = async function autoStartPhase(client, {
  phase,
  stage = null,
  channelId,
  deadlineMinutes = 180
}) {
  const channel = await client.channels.fetch(channelId);
  if (!channel) {
    console.error(`❌ autoStartPhase: nie znaleziono kanału ${channelId}`);
    return;
  }

  // 1) DEADLINE
  const nowUtc = DateTime.utc();
  const deadlineUtc = nowUtc.plus({ minutes: deadlineMinutes });
  const deadlineSql = deadlineUtc.toSQL({ includeOffset: false });

  // 2) PANEL — embed + button
  let title, description, buttonLabel, customId;

  if (phase === 'swiss') {
    const n = stage ? stage.replace('stage', '') : '?';
    title = `🟠 Etap Swiss ${n}`;
    description = 'Kliknij przycisk, aby rozpocząć typowanie fazy Swiss.';
    buttonLabel = `Typuj Swiss ${n}`;
    customId = `start_${stage}`;
  }

  else if (phase === 'playoffs') {
    title = '🏆 Typowanie Playoffs';
    description = 'Rozpocznij typowanie fazy Playoffs.';
    buttonLabel = 'Typuj Playoffs';
    customId = 'start_playoffs';
  }

  else if (phase === 'double') {
    title = '🔁 Typowanie Double Elimination';
    description = 'Rozpocznij typowanie fazy Double Elim.';
    buttonLabel = 'Typuj Double Elim';
    customId = 'start_double';
  }

  else if (phase === 'playin') {
    title = '🎫 Typowanie Play-In';
    description = 'Rozpocznij typowanie fazy Play-In.';
    buttonLabel = 'Typuj Play-In';
    customId = 'start_playin';
  }

  else {
    console.error(`❌ autoStartPhase: nieznana faza "${phase}"`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('#ff9900')
    .setFooter({
      text: `⏰ Deadline: ${deadlineUtc.toFormat('yyyy-LL-dd HH:mm')} UTC`
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(buttonLabel)
      .setStyle(ButtonStyle.Primary)
  );

  // 3) WYŚLIJ PANEL
  const msg = await channel.send({
    embeds: [embed],
    components: [row]
  });

  // 4) ZAPISZ DO active_panels (tak samo jak w /start_pickem)
  await pool.query(
    `INSERT INTO active_panels (phase, stage, message_id, channel_id, deadline, reminded, active)
     VALUES (?, ?, ?, ?, ?, 0, 1)
     ON DUPLICATE KEY UPDATE
       message_id = VALUES(message_id),
       channel_id = VALUES(channel_id),
       deadline   = VALUES(deadline),
       reminded   = 0,
       active     = 1`,
    [
      phase,
      stage,
      String(msg.id),
      String(channelId),
      deadlineSql
    ]
  );

  console.log(`✅ AutoStart: panel wysłany — ${phase}${stage ? ' ' + stage : ''}, msg=${msg.id}`);
};
