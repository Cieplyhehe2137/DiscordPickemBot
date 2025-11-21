const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../db.js');

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  const raw = interaction.values[0]; // np. swiss_stage_1
  const stage = raw.replace('swiss_stage_', 'stage'); // stage1
  const phase = 'swiss';

  const embed = new EmbedBuilder()
    .setTitle(`🟠 Etap Swiss (${stage.toUpperCase()})`)
    .setDescription('Kliknij przycisk poniżej, aby rozpocząć typowanie:')
    .setColor('#ff9900')
    .setFooter({ text: '⏰ Typowanie otwarte – brak deadline.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`start_${stage}`) // np. start_stage1
      .setLabel(`Typuj Swiss ${stage.replace('stage', '')}`)
      .setStyle(ButtonStyle.Primary)
  );

  try {
    const canMentionEveryone = interaction.guild.members.me
      .permissionsIn(interaction.channel)
      .has(PermissionFlagsBits.MentionEveryone);

    const sentMessage = await interaction.channel.send({
      content: canMentionEveryone ? '@everyone' : '🔔 Nowy panel typowania (bez pingu @everyone – włącz Mention Everyone dla roli bota w tym kanale)',
      embeds: [embed],
      components: [row],
      allowedMentions: { parse: canMentionEveryone ? ['everyone'] : [] }
    });

    await pool.query(
      `INSERT INTO active_panels (phase, stage, message_id, channel_id, reminded, closed)
       VALUES (?, ?, ?, ?, false, false)
       ON DUPLICATE KEY UPDATE
         message_id = VALUES(message_id),
         channel_id = VALUES(channel_id),
         reminded = false,
         closed = false`,
      [phase, stage, sentMessage.id, sentMessage.channel.id]
    );

    await interaction.reply({
      content: `✅ Wysłano panel Swiss (${stage.toUpperCase()})` + (canMentionEveryone ? ' z pingiem @everyone.' : ' (bez pingu @everyone).'),
      ephemeral: true
    });
  } catch (err) {
    console.error('Błąd wysyłania panelu Swiss:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Nie udało się wysłać panelu.', ephemeral: true });
    }
  }
};
