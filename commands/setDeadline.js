const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { DateTime } = require('luxon');
const { withGuild } = require('../utils/guildContext');

function formatTimeLeft(deadlineUTCDate) {
  const now = DateTime.utc();
  const dl = DateTime.fromJSDate(deadlineUTCDate);
  const diff = dl.diff(now, ['days', 'hours', 'minutes']).toObject();

  const d = Math.max(0, Math.floor(diff.days || 0));
  const h = Math.max(0, Math.floor(diff.hours || 0));
  const m = Math.max(1, Math.ceil(diff.minutes || 0));

  const parts = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  parts.push(`${m} min`);

  return parts.join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_deadline')
    .setDescription('Ustawia deadline dla danej fazy i opcjonalnie etapu')
    .addStringOption(option =>
      option
        .setName('phase')
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
      option
        .setName('data')
        .setDescription('Deadline w formacie YYYY-MM-DD HH:mm (czas PL)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('stage')
        .setDescription('Dla Swiss: np. 1 / stage1 / swiss_stage1')
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
        ephemeral: true,
      });
    }

    return withGuild(guildId, async ({ pool }) => {
      const phase = interaction.options.getString('phase');
      const rawInput = interaction.options.getString('data');
      const inputStage = interaction.options.getString('stage') || null;

      if (phase === 'swiss' && !inputStage) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Dla fazy Swiss musisz podać etap, np. `1`, `2` albo `3`.',
        });
      }

      const deadlineDate = DateTime.fromFormat(
        rawInput,
        'yyyy-MM-dd HH:mm',
        { zone: 'Europe/Warsaw' }
      );

      if (!deadlineDate.isValid) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Zły format daty. Użyj `YYYY-MM-DD HH:mm`.',
        });
      }

      if (deadlineDate <= DateTime.now()) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Deadline musi być ustawiony w przyszłości.',
        });
      }

      const deadlineUTC = deadlineDate.toUTC().toJSDate();

      let rows = [];
      let dbPhase = phase;
      let dbStageKey = null;

      if (phase === 'swiss') {
        const stageNumber = String(inputStage).match(/\d+/)?.[0];

        if (!stageNumber) {
          return interaction.reply({
            ephemeral: true,
            content: '❌ Niepoprawny etap Swiss. Użyj np. `1`, `2`, `3`, `stage1`.',
          });
        }

        dbPhase = `swiss_stage${stageNumber}`;
        dbStageKey = `stage${stageNumber}`;

        console.log('[set_deadline] swiss lookup', {
          guildId,
          phase,
          dbPhase,
          dbStageKey,
          inputStage,
        });

        const [result] = await pool.query(
          `SELECT id, channel_id, message_id, phase, stage_key
           FROM active_panels
           WHERE guild_id = ?
             AND phase = ?
             AND stage_key = ?
             AND active = 1
           ORDER BY id DESC
           LIMIT 1`,
          [guildId, dbPhase, dbStageKey]
        );

        rows = result;
      } else {
        console.log('[set_deadline] non-swiss lookup', {
          guildId,
          phase,
        });

        const [result] = await pool.query(
          `SELECT id, channel_id, message_id, phase, stage_key
           FROM active_panels
           WHERE guild_id = ?
             AND phase = ?
             AND active = 1
           ORDER BY id DESC
           LIMIT 1`,
          [guildId, phase]
        );

        rows = result;
      }

      console.log('[set_deadline] rows', rows);

      const row = rows?.[0];

      if (!row?.message_id || !row?.channel_id) {
        return interaction.reply({
          ephemeral: true,
          content:
            phase === 'swiss'
              ? `❌ Nie znaleziono aktywnego panelu dla fazy \`${dbPhase}\` i etapu \`${dbStageKey}\`.`
              : `❌ Nie znaleziono aktywnego panelu dla fazy \`${phase}\`.`,
        });
      }

      let panelChannel;
      let message;

      try {
        panelChannel = await interaction.client.channels.fetch(row.channel_id);
        message = await panelChannel.messages.fetch(row.message_id);
      } catch (err) {
        if (err.code === 10008) {
          await pool.query(
            `UPDATE active_panels
             SET active = 0, closed = 1, closed_at = NOW()
             WHERE id = ?`,
            [row.id]
          );

          return interaction.reply({
            ephemeral: true,
            content:
              '❌ Panel istnieje w bazie, ale wiadomość na Discordzie już nie istnieje. Oznaczyłem panel jako nieaktywny.',
          });
        }

        throw err;
      }

      await pool.query(
        `UPDATE active_panels
         SET deadline = ?, reminded = 0
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
        content: '✅ Deadline ustawiony poprawnie.',
      });
    });
  },
};