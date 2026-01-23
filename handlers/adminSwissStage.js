const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../db.js');

module.exports = async (interaction) => {
  if (!interaction.deferred && !interaction.replied) {
  await interaction.deferReply({ ephemeral: true });
}
const perms = interaction.memberPermissions;
if (
  !perms?.has(PermissionFlagsBits.ManageGuild) &&
  !perms?.has(PermissionFlagsBits.Administrator)
) {
  return interaction.editReply({
    content: '🚫 Nie masz uprawnień do utworzenia panelu.'
  });
}


  const raw = interaction.values[0]; // np. swiss_stage_1
  const stage = raw.replace('swiss_stage_', 'stage'); // stage1
  const phase = 'swiss';
  const matchPhaseKey = `swiss_${stage}`; // np. swiss_stage1

  const embed = new EmbedBuilder()
    .setTitle(`🟠 Etap Swiss (${stage.toUpperCase()})`)
    .setDescription('Kliknij przycisk poniżej, aby rozpocząć typowanie:')
    .setColor('#ff9900')
    .setFooter({ text: '⏰ Typowanie otwarte – brak deadline.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`start_${stage}`)
      .setLabel(`Typuj Swiss ${stage.replace('stage', '')}`)
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`match_pick:${matchPhaseKey}`)
      .setLabel('🎯 Typuj wyniki meczów')
      .setStyle(ButtonStyle.Success)
  );

  try {
    // 🔥 sprawdzamy uprawnienie do @everyone
    const canMentionEveryone = interaction.guild.members.me
      .permissionsIn(interaction.channel)
      .has(PermissionFlagsBits.MentionEveryone);

    // const pingText = canMentionEveryone ? '@everyone ' : ''; 
    
    const sentMessage = await interaction.channel.send({
      // content: `${pingText}🔔 Nowy panel typowania Swiss (${stage.toUpperCase()})`,
      embeds: [embed],
      components: [row],
      // allowedMentions: { parse: canMentionEveryone ? ['everyone'] : [] } 
    });

    await pool.query(
      `INSERT INTO active_panels
      (guild_id, phase, stage, message_id, channel_id, reminded, closed, active)
      VALUES (?, ?, ?, ?, ?, false, false, 1)
      ON DUPLICATE KEY UPDATE
        message_id = VALUES(message_id),
        channel_id = VALUES(channel_id),
        reminded = false,
        closed = false,
        active = 1`,
        [interaction.guildId, phase, stage, sentMessage.id, sentMessage.channel.id]
    );

    await interaction.editReply({
      content:
        canMentionEveryone
          ? `✅ Wysłano panel Swiss (${stage.toUpperCase()}) z pingiem **@everyone**.`
          : `⚠️ Panel Swiss (${stage.toUpperCase()}) wysłany, ale **bot nie ma permisji Mention Everyone** – brak pingu.`,
      ephemeral: true
    });
  } catch (err) {
    console.error('Błąd wysyłania panelu Swiss:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.editReply({ content: '❌ Nie udało się wysłać panelu.', ephemeral: true });
    }
  }
};
