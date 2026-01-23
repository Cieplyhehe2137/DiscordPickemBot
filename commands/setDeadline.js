// commands/setDeadline.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { DateTime } = require('luxon');
const pool = require('../db');
const { withGuild } = require('../utils/guildContext');

// ⏱️ helper do formatowania „ile zostało”
function formatTimeLeft(deadlineUTCDate) {
  const now = DateTime.utc();
  const dl = DateTime.fromJSDate(deadlineUTCDate); // w UTC
  const diff = dl.diff(now, ['days', 'hours', 'minutes']).toObject();

  let d = Math.max(0, Math.floor(diff.days || 0));
  let h = Math.max(0, Math.floor(diff.hours || 0));
  let m = Math.max(0, Math.ceil(diff.minutes || 0)); // zaokrąglij w górę

  const parts = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  parts.push(`${Math.max(1, m)} min`);
  return parts.join(' ');
}

// ✅ normalizacja nazwy etapu do formy z bazy (stage1/stage2/stage3)
function normalizeStage(phase, rawStage) {
  if (!rawStage) return null;
  if (phase !== 'swiss') return rawStage; // inne fazy nie mają stage
  const s = String(rawStage).toLowerCase().trim();
  // akceptujemy: "swiss_stage_1", "stage1", "1"
  const m = s.match(/(?:swiss_)?stage[_-]?(\d)|^(\d)$/);
  const num = m ? (m[1] || m[2]) : null;
  return num ? `stage${num}` : rawStage;
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
        .setDescription('np. swiss_stage_1 / stage1 / 1 (puste dla faz bez etapów)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta komenda działa tylko na serwerze (nie w DM).',
        ephemeral: true
      });
    }

    return withGuild(guildId, async () => {
      const phase = interaction.options.getString('phase');
      const inputStage = interaction.options.getString('stage') || null;
      const stage = normalizeStage(phase, inputStage);
      const rawInput = interaction.options.getString('data');

      const deadlineDate = DateTime.fromFormat(rawInput, 'yyyy-MM-dd HH:mm', { zone: 'Europe/Warsaw' });
      if (!deadlineDate.isValid) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Zły format daty. Użyj `YYYY-MM-DD HH:mm`, np. `2025-07-25 11:30`.'
        });
      }
      const deadlineUTC = deadlineDate.toUTC().toJSDate();

      // 🔎 znajdź aktywny panel dla fazy(+etapu) (nie zakładaj, że komenda jest odpalana w tym samym kanale!)
      const [rows] = await pool.query(
  `SELECT id, channel_id, message_id
   FROM active_panels
   WHERE guild_id = ?
     AND phase = ?
     AND stage <=> ?
     AND active = 1
   ORDER BY id DESC
   LIMIT 1`,
  [guildId, phase, stage]
);

      const row = rows?.[0];
      if (!row?.message_id || !row?.channel_id) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Nie znaleziono aktywnego panelu. Użyj najpierw `/start_pickem` (i wybierz etap dla Swiss).'
        });
      }

      let panelChannel;
      let message;

      try {
        panelChannel = await interaction.client.channels.fetch(row.channel_id);
        message = await panelChannel.messages.fetch(row.message_id);
      } catch (e) {
        const code = e?.code;

        // 10008 = Unknown Message (usunięta)
        if (code === 10008) {
          await pool.query(
            `UPDATE active_panels
SET active = 0, closed = 1, closed_at = NOW()
WHERE id = ? AND guild_id = ?
`,
            [row.id, guildId]
          );

          return interaction.reply({
            ephemeral: true,
            content: `❌ Panel (${row.message_id}) nie istnieje (został usunięty). Oznaczyłem go jako nieaktywny w bazie — utwórz panel ponownie.`
          });
        }

        // 50001 = Missing Access, 50013 = Missing Permissions
        if (code === 50001 || code === 50013) {
          return interaction.reply({
            ephemeral: true,
            content:
              `❌ Nie mam dostępu żeby pobrać panel (${row.message_id}).\n` +
              `Sprawdź permisje bota w kanale panelu: View Channel + Read Message History + Send Messages + Embed Links` +
              (panelChannel?.isThread?.() ? ' + Send Messages in Threads' : '') +
              `. (kod: ${code})`
          });
        }

        return interaction.reply({
          ephemeral: true,
          content: `❌ Nie mogę pobrać wiadomości panelu (${row.message_id}). Kod: ${code || 'brak'}`
        });
      }

      // 📝 UPSERT: zapisz deadline (do kanału panelu, nie do kanału komendy!)
      await pool.query(
        `INSERT INTO active_panels
        (guild_id, phase, stage, channel_id, message_id, deadline, reminded, closed, active)
        VALUES(?, ?, ?, ?, ?, ?, 0, 0, 1)
        ON DUPLICATE KEY UPDATE
  deadline = VALUES(deadline),
  reminded = 0,
  closed = 0,
  active = 1,
  channel_id = VALUES(channel_id),
  message_id = VALUES(message_id)
`,
        [guildId, phase, stage, panelChannel.id, message.id, deadlineUTC]
      );

      // 🕒 ustaw/odśwież footer z czasem do deadline
      const timeLeft = formatTimeLeft(deadlineUTC);
      const baseEmbed = message.embeds?.[0] ? EmbedBuilder.from(message.embeds[0]) : new EmbedBuilder();
      const updatedEmbed = baseEmbed.setFooter({ text: `🕒 Deadline za ${timeLeft}` });
      await message.edit({ embeds: [updatedEmbed] });

      // ⏱️ jeśli deadline już minął → natychmiast zamknij panel (edge case)
      if (DateTime.utc().toJSDate() >= deadlineUTC) {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('disabled_button')
            .setLabel('Typowanie zamknięte')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        const closedEmbed = (message.embeds?.[0] ? EmbedBuilder.from(message.embeds[0]) : new EmbedBuilder())
          .setFooter({ text: '🔒 Typowanie zamknięte – deadline minął' });

        await message.edit({ embeds: [closedEmbed], components: [disabledRow] });

        await pool.query(
          `UPDATE active_panels SET closed = 1 WHERE id = ? AND guild_id = ?`,
          [row.id, guildId]
        );

        return interaction.reply({ ephemeral: true, content: '🔒 Deadline już minął – panel zamknięty.' });
      }

      // ✅ potwierdzenie
      await interaction.reply({
        ephemeral: true,
        content:
          `✅ Ustawiono deadline dla \`${phase}\`${stage ? ` (${stage})` : ''}:\n` +
          `📅 **${deadlineDate.toFormat('yyyy-LL-dd HH:mm')} (Warszawa)**\n` +
          `🕒 Zapisany jako UTC: \`${deadlineUTC.toISOString()}\``
      });
    });
  }
};
