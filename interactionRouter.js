const logger = require('./utils/logger');

// Bezpieczny ACK dla button/select gdy brakuje handlera (żeby Discord nie pokazywał "Ta czynność się nie powiodła")
async function safeDeferUpdate(interaction) {
  if (interaction.replied || interaction.deferred) return;
  try {
    await interaction.deferUpdate();
  } catch (_) {
    // ignore
  }
}

module.exports = async function handleInteraction(interaction, client, handlers, maps) {
  const { buttonMap, modalMap, selectMap, dropdownMap } = maps;

  try {
    logger.info('interaction', 'Interaction received', {
      type: interaction.type,
      userId: interaction.user?.id,
      customId: interaction.customId,
    });

    // === SLASH COMMAND ===
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction);
      return;
    }

    // === BUTTON ===
    if (interaction.isButton()) {
      let customId = interaction.customId;

      // === RANKING (buttons, dwukropek) ===
      if (customId.startsWith('ranking:')) {
        const rankingCmd = require('./commands/ranking.js');
        return rankingCmd.handleComponent(interaction);
      }

      // (legacy) stary system z podkreślnikiem
      if (customId.startsWith('ranking_')) {
        const handler = require('./handlers/rankingPagination');
        return handler(interaction, client);
      }

      // Aliasowanie customId
      if (customId === 'clear_user_picks') customId = 'clear_db_confirm';
      if (customId === 'full_reset') customId = 'clear_db_with_results';
      if (customId === 'clear_official_results') customId = 'clear_only_results_confirm';

      // Najpierw: ścisłe/dynamiczne dopasowanie z buttonMap
      let handlerName =
        buttonMap[customId] ||
        (Object.keys(buttonMap).find((key) => customId.startsWith(key)) &&
          buttonMap[Object.keys(buttonMap).find((key) => customId.startsWith(key))]) ||
        (customId?.startsWith('confirm_end_pickem') && 'confirmEndPickem') ||
        (customId?.startsWith('confirm_stage') && 'submitSwissDropdown');

      // Obsługa clear fallback
      if (!handlerName && customId?.startsWith('clear_')) {
        logger.warn('interaction', 'Fallback clearDatabaseHandler', { customId });
        handlerName = 'clearDatabaseHandler';
      }

      // Legacy: część "confirm_*" może być kierowana przez dropdownMap
      if (dropdownMap?.[customId]) {
        const nameOrFile = dropdownMap[customId];
        const fn = handlers?.[nameOrFile] || require(`./handlers/${nameOrFile}`);
        return fn(interaction, client);
      }

      if (!handlerName || !handlers[handlerName]) {
        logger.warn('interaction', 'Unhandled button', { customId });
        await safeDeferUpdate(interaction);
        return;
      }

      // === EXPORT RANKING ===
      if (customId === 'export_ranking') {
        try {
          await handlers[handlerName](interaction, client);
        } catch (err) {
          logger.error('interaction', 'Export ranking failed', {
            message: err.message,
            stack: err.stack,
          });

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ Wystąpił błąd podczas generowania pliku.',
              ephemeral: true,
            });
          } else {
            await interaction.followUp({
              content: '❌ Wystąpił błąd podczas generowania pliku.',
              ephemeral: true,
            });
          }
        }
        return;
      }

      // === CALCULATE SCORES ===
      if (customId === 'calculate_scores') {
        await interaction.deferReply({ ephemeral: true });
        try {
          await handlers[handlerName](client);
          await interaction.followUp('✅ Punkty zostały przeliczone!');
        } catch (err) {
          logger.error('interaction', 'Calculate scores failed', {
            message: err.message,
            stack: err.stack,
          });
          await interaction.followUp('❌ Wystąpił błąd podczas przeliczania punktów.');
        }
        return;
      }

      // === Inne przyciski ===
      await handlers[handlerName](interaction, client);
      return;
    }

    // === MODAL SUBMIT ===
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;
      const handlerName = modalMap?.[customId];
      if (handlerName && handlers[handlerName]) {
        await handlers[handlerName](interaction, client);
      } else {
        logger.warn('interaction', 'Unhandled modal', { customId });
      }
      return;
    }

    // === SELECT MENU ===
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      // ranking
      if (customId.startsWith('ranking:')) {
        const rankingCmd = require('./commands/ranking.js');
        return rankingCmd.handleComponent(interaction);
      }

      // 1) selectMap (np. admin_select_swiss_stage, archive_select)
      if (selectMap?.[customId]) {
        const handlerName = selectMap[customId];
        if (handlers?.[handlerName]) {
          return handlers[handlerName](interaction, client);
        }
        // gdyby ktoś w mapie podał nazwę pliku zamiast handlerName
        try {
          const fn = require(`./handlers/${handlerName}`);
          return fn(interaction, client);
        } catch (_) {
          logger.error('interaction', 'Select handler not found', { customId, handlerName });
          await safeDeferUpdate(interaction);
          return;
        }
      }

      // 2) legacy dropdownMap (większość Twoich selecty idzie tędy)
      if (dropdownMap?.[customId]) {
        const nameOrFile = dropdownMap[customId];
        const fn = handlers?.[nameOrFile] || require(`./handlers/${nameOrFile}`);
        return fn(interaction, client);
      }

      // 3) brak handlera -> ACK + log
      logger.warn('interaction', 'Unhandled select menu', { customId });
      await safeDeferUpdate(interaction);
      return;
    }
  } catch (err) {
    logger.error('interaction', 'Unhandled interactionCreate error', {
      message: err.message,
      stack: err.stack,
    });

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: '❌ Wystąpił błąd podczas obsługi interakcji.',
          ephemeral: true,
        });
      } catch (_) {
        // ignore
      }
    }
  }
};
