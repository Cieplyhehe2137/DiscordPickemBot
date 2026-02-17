// commands/setDeadline.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { DateTime } = require('luxon');
const { withGuild } = require('../utils/guildContext');
const { raw } = require('express');

// ⏱️ helper do formatowania „ile zostało”
function formatTimeLeft(deadlineUTCDate) {
  const now = DateTime.utc();
  const dl = DateTime.fromJSDate(deadlineUTCDate);
  const diff = dl.diff(now, ['days', 'hours', 'minutes']).toObject();

  let d = Math.max(0, Math.floor(diff.days || 0));
  let h = Math.max(0, Math.floor(diff.hours || 0));
  let m = Math.max(1, Math.ceil(diff.minutes || 0));

  const parts = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  parts.push(`${m} min`);
  return parts.join(' ');
}

const inputStage = interaction.options.getString('stage') || null;

let stageKey = null;

if (inputStage) {
  const stageNumber = String(inputStage).replace(/\D/g, ''); // wyciąga tylko cyfrę
  stageKey = `swiss_stage${stageNumber}`; // swiss_stage1
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_deadline')
    .setDescription('Ustawia deadline dla danej fazy i (opcjonalnie) etapu')
    .addStringOption(option =>
      option.setName('phase')
        .setDescription('Faza turnieju')
        .setRequired(true)
        .addChoices(
          { name: 'Swiss', value: 'swiss' },
          { name: 'Playoffs', value: 'playoffs' },
          { name: 'Double Elimination', value: 'doubleelim' },
          { name: 'Play-In', value: 'playin' }
        )
    )
    .addStringOption(option =>
      option.setName('data')
        .setDescription('Deadline w formacie YYYY-MM-DD HH:mm (czas PL)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('stage')
        .setDescription('np. swiss_stage_1 / stage1 / 1')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta komenda działa tylko na serwerze.',
        ephemeral: true
      });
    }

    return withGuild(guildId, async ({ pool }) => {
      const phase = interaction.options.getString('phase');
      const inputStage = interaction.options.getString('stage') || null;
      const normalizedStage = normalizeStage(phase, inputStage);

      // 🔥 budujemy stage_key dokładnie tak jak w active_panels
      const stageKey = normalizedStage
        ? `swiss_${normalizedStage}`   // swiss_stage1
        : null;
      const rawInput = interaction.options.getString('data');

      const deadlineDate = DateTime.fromFormat(
        rawInput,
        'yyyy-MM-dd HH:mm',
        { zone: 'Europe/Warsaw' }
      );

      // 🟥 P0 — zły format
      if (!deadlineDate.isValid) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Zły format daty. Użyj `YYYY-MM-DD HH:mm`.'
        });
      }

      // 🟥 P0 — deadline w przeszłości
      if (deadlineDate <= DateTime.now()) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Deadline musi być ustawiony w przyszłości.'
        });
      }

      const deadlineUTC = deadlineDate.toUTC().toJSDate();

      const [rows] = await pool.query(
        `SELECT id, channel_id, message_id
         FROM active_panels
         WHERE guild_id = ?
           AND phase = ?
           AND stage_key <=> ?
           AND active = 1
         ORDER BY id DESC
         LIMIT 1`,
        [guildId, phase, stageKey]
      );

      const row = rows?.[0];
      if (!row?.message_id || !row?.channel_id) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Nie znaleziono aktywnego panelu dla tej fazy.'
        });
      }

      const panelChannel = await interaction.client.channels.fetch(row.channel_id);
      const message = await panelChannel.messages.fetch(row.message_id);

      // ⚠️ WYMAGA UNIQUE(guild_id, phase, stage)
      await pool.query(
        `UPDATE active_panels
   SET
     deadline = ?,
     reminded = 0
   WHERE id = ?`,
        [deadlineUTC, row.id]
      );


      const timeLeft = formatTimeLeft(deadlineUTC);
      const embed = message.embeds?.[0]
        ? EmbedBuilder.from(message.embeds[0])
        : new EmbedBuilder();

      embed.setFooter({ text: `🕒 Deadline za ${timeLeft}` });
      await message.edit({ embeds: [embed] });

      await interaction.reply({
        ephemeral: true,
        content: '✅ Deadline ustawiony poprawnie.'
      });
    });
  }
};
