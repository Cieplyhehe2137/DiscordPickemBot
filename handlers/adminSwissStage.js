const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { withGuild } = require('../utils/guildContext');

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

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

  const raw = interaction.values?.[0]; // np. swiss_stage_1
  if (!raw) {
    return interaction.editReply({
      content: '❌ Nie wybrano etapu.'
    });
  }

  const stageNumber = String(raw).match(/\d+/)?.[0];

  if (!stageNumber) {
    return interaction.editReply({
      content: '❌ Nie udało się rozpoznać numeru etapu Swiss.'
    });
  }

  const phase = `swiss_stage${stageNumber}`; // swiss_stage1
  const stage = `stage${stageNumber}`;       // stage1

  const embed = new EmbedBuilder()
    .setTitle(`🟠 Etap Swiss (STAGE ${stageNumber})`)
    .setDescription('Kliknij przycisk poniżej, aby rozpocząć typowanie:')
    .setColor('#ff9900')
    .setFooter({ text: '⏰ Typowanie otwarte – brak deadline.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`start_${phase}`)
      .setLabel(`Typuj Swiss ${stageNumber}`)
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`match_pick:${phase}`)
      .setLabel('🎯 Typuj wyniki meczów')
      .setStyle(ButtonStyle.Success)
  );

  try {
    const sentMessage = await interaction.channel.send({
      embeds: [embed],
      components: [row],
    });

    await withGuild(guildId, async ({ pool }) => {
      await pool.query(
        `
        INSERT INTO active_panels
          (guild_id, phase, stage, message_id, channel_id, reminded, closed, active, deadline)
        VALUES (?, ?, ?, ?, ?, 0, 0, 1, NULL)
        ON DUPLICATE KEY UPDATE
          message_id = VALUES(message_id),
          channel_id = VALUES(channel_id),
          stage = VALUES(stage),
          reminded = 0,
          closed = 0,
          active = 1,
          deadline = NULL
        `,
        [guildId, phase, stage, sentMessage.id, sentMessage.channel.id]
      );
    });

    await interaction.editReply({
      content: `✅ Wysłano panel Swiss (STAGE ${stageNumber}).`
    });
  } catch (err) {
    console.error('Błąd wysyłania panelu Swiss:', err);

    await interaction.editReply({
      content: '❌ Nie udało się wysłać panelu.'
    });
  }
};