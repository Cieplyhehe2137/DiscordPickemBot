const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DateTime } = require('luxon');
const pool = require('../db.js');
const logger = require('./logger');

/**
 * startPhase
 * rowOrPhase:
 *  - string, np. 'swiss_stage_1'
 *  - albo cały wiersz z scheduled_starts
 */
module.exports = async function startPhase(client, rowOrPhase, maybeChannelId) {
  // Ujednolicamy format wejścia
  let row;
  if (typeof rowOrPhase === 'string') {
    row = {
      phase: rowOrPhase,
      channel_id: maybeChannelId || process.env.PICKEM_PANEL_CHANNEL_ID || null,
      deadline_minutes: parseInt(process.env.DEFAULT_DEADLINE_MINUTES || '180', 10),
    };
  } else {
    row = rowOrPhase;
    if (!row.deadline_minutes) {
      row.deadline_minutes = parseInt(process.env.DEFAULT_DEADLINE_MINUTES || '180', 10);
    }
  }

  const phaseKey = row.phase;
  const channelId = row.channel_id || process.env.PICKEM_PANEL_CHANNEL_ID;

  if (!channelId) {
    throw new Error('Brak channel_id w scheduled_starts oraz PICKEM_PANEL_CHANNEL_ID w .env');
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel) throw new Error(`Nie mogę znaleźć kanału o ID ${channelId}`);

  let phase, stage = null;
  let buttonCustomId, buttonLabel, title, description;

  if (phaseKey.startsWith('swiss_stage_')) {
    phase = 'swiss';
    stage = phaseKey.replace('swiss_stage_', 'stage'); // stage1, stage2, stage3
    const stageNum = stage.replace('stage', '');
    title = `🟠 Etap Swiss (Stage ${stageNum})`;
    description = 'Kliknij przycisk poniżej, aby rozpocząć typowanie Swiss.';
    buttonCustomId = `start_${stage}`; // np. start_stage1
    buttonLabel = `Typuj Swiss ${stageNum}`;
  } else if (phaseKey === 'playoffs') {
    phase = 'playoffs';
    title = '🏆 Typowanie Playoffs';
    description = 'Kliknij przycisk poniżej, aby rozpocząć typowanie fazy Playoffs.';
    buttonCustomId = 'start_playoffs';
    buttonLabel = 'Typuj Playoffs';
  } else if (phaseKey === 'double_elim') {
    phase = 'double';
    title = '🟣 Typowanie Double Elimination';
    description = 'Kliknij przycisk poniżej, aby rozpocząć typowanie Double Elim.';
    buttonCustomId = 'start_double';
    buttonLabel = 'Typuj Double Elim';
  } else if (phaseKey === 'playin') {
    phase = 'playin';
    title = '🟢 Typowanie Play-In';
    description = 'Kliknij przycisk poniżej, aby rozpocząć typowanie fazy Play-In.';
    buttonCustomId = 'start_playin';
    buttonLabel = 'Typuj Play-In';
  } else {
    throw new Error(`Nieznana phase w scheduled_starts: ${phaseKey}`);
  }

  // Liczymy deadline (UTC)
  const nowUtc = DateTime.utc();
  const deadlineUtc = nowUtc.plus({ minutes: row.deadline_minutes });

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('#ff9900')
    .setFooter({
      text: `⏰ Deadline: ${deadlineUtc.toFormat('dd.LL.yyyy HH:mm')} UTC`
    });

  const rowComponents = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buttonCustomId)
      .setLabel(buttonLabel)
      .setStyle(ButtonStyle.Primary)
  );

  const message = await channel.send({
    embeds: [embed],
    components: [rowComponents],
  });

  // Zapis do active_panels – dopasuj nazwy kolumn, jeśli masz inne
  await pool.query(
    `
    INSERT INTO active_panels (phase, stage, message_id, channel_id, guild_id, deadline, reminded, active)
    VALUES (?, ?, ?, ?, ?, ?, 0, 1)
    `,
    [
      phase,
      stage || null,
      message.id,
      channel.id,
      message.guildId,
      deadlineUtc.toISO()
    ]
  );

  logger.info(
    { phase, stage, messageId: message.id, channelId: channel.id, deadline: deadlineUtc.toISO() },
    '🚀 Auto-start fazy z ustawionym deadline'
  );

  return { message, deadlineUtc };
};
