const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db.js');
const { safeQuery } = require('../utils/safeQuery.js');
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

  const pool = db.getPoolForGuild(guildId);

  const userMeta = {
    guildId,
    phase,
    userId: interaction.user.id,
    username: interaction.user.tag,
  };

  logger.info('endPickem', 'Confirm end pickem requested', userMeta);

  try {
    await interaction.deferReply({ ephemeral: true });

    // ⚠️ Zakładamy, że active_panels jest per-guild
    // P1: jeśli nie ma guild_id w tabeli → migracja
    const [rows] = await safeQuery(
      pool,
      'SELECT channel_id, message_id FROM active_panels WHERE phase = ? LIMIT 1',
      [phase],
      {
        guildId,
        scope: 'endPickem',
        label: 'select active_panels',
      }
    );

    if (!rows.length) {
      return interaction.followUp({
        content: `⚠️ Nie znaleziono aktywnego panelu dla fazy **${phase}**.`,
        ephemeral: true,
      });
    }

    const { channel_id, message_id } = rows[0];

    const channel = await interaction.client.channels.fetch(channel_id).catch(() => null);
    if (!channel || !channel.isTextBased?.()) {
      logger.warn('endPickem', 'Channel not found or not text-based', {
        ...userMeta,
        channel_id,
      });

      await safeQuery(
        pool,
        'DELETE FROM active_panels WHERE phase = ?',
        [phase],
        {
          guildId,
          scope: 'endPickem',
          label: 'delete active_panels',
        }
      );

      return interaction.followUp({
        content: '⚠️ Panel już nie istnieje. Wpis został wyczyszczony.',
        ephemeral: true,
      });
    }

    // 🔒 Guard — kanał musi należeć do tej guildy
    if (channel.guildId && String(channel.guildId) !== String(guildId)) {
      logger.error('endPickem', 'Channel belongs to another guild', {
        ...userMeta,
        channelGuildId: channel.guildId,
      });

      return interaction.followUp({
        content: '❌ Panel należy do innego serwera.',
        ephemeral: true,
      });
    }

    let message = null;
    try {
      message = await channel.messages.fetch(message_id);
    } catch (err) {
      if (err.code === 10008) {
        logger.warn('endPickem', 'Message already deleted, cleaning DB', userMeta);
      } else {
        throw err;
      }
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

      logger.info('endPickem', 'Panel buttons disabled', userMeta);
    }

    await pool.query('DELETE FROM active_panels WHERE phase = ?', [phase]);
    logger.info('endPickem', 'Active panel entry removed', userMeta);

    return interaction.followUp({
      content: `✅ Typowanie dla fazy **${phase}** zostało zakończone.`,
      ephemeral: true,
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
    } catch (_) { }
  }
};
