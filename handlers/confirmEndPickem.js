const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { withGuild } = require('../utils/guildContext');
const isAdmin = require('../utils/isAdmin');
const logger = require('../utils/logger.js');

module.exports = async (interaction) => {
  if (!interaction.isButton()) return;

  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true,
    });
  }

  // 🔒 ADMIN ONLY
  if (!isAdmin(interaction)) {
    logger.warn('endPickem', 'Unauthorized confirmEndPickem attempt', {
      guildId,
      userId: interaction.user.id,
      customId: interaction.customId,
    });

    return interaction.reply({
      content: '❌ Brak uprawnień do tej operacji.',
      ephemeral: true,
    });
  }

  let phase;
  if (interaction.customId === 'confirm_end_pickem_swiss') phase = 'swiss';
  else if (interaction.customId === 'confirm_end_pickem_playoffs') phase = 'playoffs';
  else if (interaction.customId === 'confirm_end_pickem_doubleelim') phase = 'doubleelim';
  else if (interaction.customId === 'confirm_end_pickem_playin') phase = 'playin';
  else return;

  const userMeta = {
    guildId,
    phase,
    userId: interaction.user.id,
    username: interaction.user.tag,
  };

  logger.info('endPickem', 'Confirm end pickem requested', userMeta);

  try {
    await interaction.deferReply({ ephemeral: true });

    await withGuild(interaction, async ({ pool, guildId }) => {
      // 🔎 szukamy aktywnego panelu GUILD SAFE
      const [rows] = await pool.query(
        `
        SELECT id, channel_id, message_id
        FROM active_panels
        WHERE guild_id = ?
          AND phase = ?
          AND active = 1
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, phase]
      );

      if (!rows.length) {
        return interaction.followUp({
          content: `⚠️ Nie znaleziono aktywnego panelu dla fazy **${phase}**.`,
          ephemeral: true,
        });
      }

      const { id, channel_id, message_id } = rows[0];

      const channel = await interaction.client.channels.fetch(channel_id).catch(() => null);
      if (!channel || !channel.isTextBased?.()) {
        logger.warn('endPickem', 'Channel not found, cleaning DB', userMeta);

        await pool.query(
          `UPDATE active_panels SET active = 0, closed = 1 WHERE id = ? AND guild_id = ?`,
          [id, guildId]
        );

        return interaction.followUp({
          content: '⚠️ Panel już nie istnieje. Wpis został wyczyszczony.',
          ephemeral: true,
        });
      }

      let message = null;
      try {
        message = await channel.messages.fetch(message_id);
      } catch (err) {
        if (err.code !== 10008) throw err;
      }

      if (message) {
        const embed = message.embeds?.[0];

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('disabled_button')
            .setLabel('Typowanie zamknięte')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        await message.edit({
          embeds: embed ? [embed] : [],
          components: [disabledRow],
        });
      }

      await pool.query(
        `UPDATE active_panels SET active = 0, closed = 1 WHERE id = ? AND guild_id = ?`,
        [id, guildId]
      );

      logger.info('endPickem', 'Pickem closed', userMeta);

      return interaction.followUp({
        content: `✅ Typowanie dla fazy **${phase}** zostało zakończone.`,
        ephemeral: true,
      });
    });

  } catch (err) {
    logger.error('endPickem', 'confirmEndPickem failed', {
      ...userMeta,
      message: err.message,
      stack: err.stack,
    });

    try {
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Wystąpił błąd podczas zamykania typowania.',
          ephemeral: true,
        });
      }
    } catch (_) {}
  }
};
