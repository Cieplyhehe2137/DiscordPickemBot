const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../db.js');
const logger = require('../utils/logger.js');

module.exports = async (interaction) => {
  if (!interaction.isButton()) return;

  let phase;
  if (interaction.customId === 'confirm_end_pickem_swiss') phase = 'swiss';
  else if (interaction.customId === 'confirm_end_pickem_playoffs') phase = 'playoffs';
  else if (interaction.customId === 'confirm_end_pickem_doubleelim') phase = 'doubleelim';
  else if (interaction.customId === 'confirm_end_pickem_playin') phase = 'playin';
  else return;

  const userId = interaction.user.id;
  const username = interaction.user.username;
  logger.info(`➡️ ConfirmEndPickem dla phase=${phase} przez użytkownika ${username} (${userId})`);

  try {
    const [rows] = await pool.query('SELECT channel_id, message_id FROM active_panels WHERE phase = ?', [phase]);
    
    if (rows.length === 0) {
      return await interaction.reply({
        content: `⚠️ Nie znaleziono aktywnego panelu dla fazy **${phase}**.`,
        ephemeral: true
      });
    }

    const { channel_id, message_id } = rows[0];
    logger.info(`✅ Dane z DB: channel=${channel_id}, message=${message_id}`);

    try {
      const channel = await interaction.client.channels.fetch(channel_id);
      if (!channel) {
        logger.error(`❌ Nie znaleziono kanału o ID: ${channel_id} dla użytkownika ${username} (${userId})`);
        return await interaction.reply({
          content: `❌ Nie można znaleźć kanału dla fazy **${phase}**.`,
          ephemeral: true
        });
      }

      const message = await channel.messages.fetch(message_id);
      if (!message) {
        logger.error(`❌ Nie znaleziono wiadomości o ID: ${message_id} dla użytkownika ${username} (${userId})`);
        return await interaction.reply({
          content: `❌ Nie można znaleźć wiadomości dla fazy **${phase}**.`,
          ephemeral: true
        });
      }

      const embed = message.embeds[0];
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('disabled_button')
          .setLabel('Typowanie zamknięte')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      await message.edit({ embeds: [embed], components: [disabledRow] });
      logger.info(`✅ Przyciski dla phase=${phase} zdezaktywowane przez użytkownika ${username} (${userId})`);

    } catch (err) {
      if (err.code === 10008) {
        logger.warn(`⚠️ Wiadomość dla phase=${phase} już nie istnieje – usuwam z DB. Użytkownik: ${username} (${userId})`);
      } else {
        logger.error(`❌ Błąd podczas edycji wiadomości dla phase=${phase} przez użytkownika ${username} (${userId}):`, err);
        return await interaction.reply({
          content: `❌ Wystąpił błąd podczas edycji wiadomości dla fazy **${phase}**.`,
          ephemeral: true
        });
      }
    }

    await pool.query(`DELETE FROM active_panels WHERE phase = ?`, [phase]);
    logger.info(`✅ Usunięto wpis z DB dla phase=${phase} przez użytkownika ${username} (${userId})`);

    return await interaction.reply({
      content: `✅ Typowanie dla fazy **${phase}** zostało zakończone.`,
      ephemeral: true
    });

  } catch (err) {
    logger.error(`❌ Błąd confirmEndPickem dla ${phase} przez użytkownika ${username} (${userId}):`, err);
    try {
      return await interaction.reply({
        content: `❌ Wystąpił błąd podczas próby zakończenia typowania dla fazy **${phase}**.`,
        ephemeral: true
      });
    } catch (sendErr) {
      logger.error(`❌ Nie udało się wysłać reply w catch dla użytkownika ${username} (${userId}):`, sendErr);
    }
  }
};
