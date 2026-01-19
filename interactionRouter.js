const path = require('path');
const logger = require('./logger');

const buttonMap = require('./maps/buttonMap');
const dropdownMap = require('./maps/dropdownMap');
const modalMap = require('./maps/modalMap');

module.exports = async function handleInteraction(interaction) {
  try {
    // ======================
    // BUTTON
    // ======================
    if (interaction.isButton()) {
      const handlerName = buttonMap[interaction.customId];

      if (!handlerName) {
        logger.warn('Unhandled button', {
          customId: interaction.customId,
          guildId: interaction.guildId
        });
        return;
      }

      const handler = require(path.join(__dirname, 'handlers', handlerName));
      return handler(interaction);
    }

    // ======================
    // STRING SELECT
    // ======================
    if (interaction.isStringSelectMenu()) {
      const handlerName = dropdownMap[interaction.customId];

      if (!handlerName) {
        logger.warn('Unhandled select', {
          customId: interaction.customId,
          guildId: interaction.guildId,
          values: interaction.values
        });
        await interaction.deferUpdate();
        return;
      }

      const handler = require(path.join(__dirname, 'handlers', handlerName));
      return handler(interaction);
    }

    // ======================
    // MODAL
    // ======================
    if (interaction.isModalSubmit()) {
      const handlerName = modalMap[interaction.customId];

      if (!handlerName) {
        logger.warn('Unhandled modal', {
          customId: interaction.customId,
          guildId: interaction.guildId
        });
        return;
      }

      const handler = require(path.join(__dirname, 'handlers', handlerName));
      return handler(interaction);
    }

  } catch (err) {
    logger.error('Unhandled interactionCreate error', {
      message: err.message,
      stack: err.stack,
      customId: interaction.customId,
      guildId: interaction.guildId
    });

    // safety net – żeby Discord nie krzyczał
    if (interaction.isRepliable() && !interaction.replied) {
      try {
        await interaction.reply({
          content: '❌ Wystąpił błąd podczas obsługi interakcji.',
          ephemeral: true
        });
      } catch { }
    }
  }
};
