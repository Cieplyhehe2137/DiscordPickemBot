const path = require('path');
const fs = require('fs');
const exportClassification = require('./handlers/exportClassification');

module.exports = async function handleInteraction(interaction, client, handlers, maps, logger) {
  const { buttonMap, modalMap, selectMap, dropdownMap } = maps;

  try {

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

      // === HLTV: pobierz listę eventów ===
      if (customId === 'hltv_fetch_events') {
        return require('./handlers/hltvFetchEvents')(interaction);
      }

      // Znajdź pasujący handler
      let handlerName =
        buttonMap[customId] ||
        (Object.keys(buttonMap).find(key => customId.startsWith(key)) && buttonMap[Object.keys(buttonMap).find(key => customId.startsWith(key))]) ||
        (customId?.startsWith('confirm_end_pickem') && 'confirmEndPickem') ||
        (customId?.startsWith('confirm_stage') && 'submitSwissDropdown');

      // Obsługa clear fallback
      if (!handlerName && customId?.startsWith('clear_')) {
        console.log(`⚡ Fallback: ustawiam handler na clearDatabaseHandler dla ${customId}`);
        handlerName = 'clearDatabaseHandler';
      }

      // Obsługa dropdown fallback (np. confirm_swiss_results_stage1)
      if (dropdownMap[customId]) {
        const file = dropdownMap[customId];
        try {
          const fn = require(`./handlers/${file}`);
          return fn(interaction, client);
        } catch (err) {
          console.error(`❌ Błąd przy ładowaniu ${file}:`, err);
          if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: `❌ Nie udało się załadować handlera ${file}.`, ephemeral: true });
          }
          return;
        }
      }

      if (!handlerName || !handlers[handlerName]) return;

      // === EXPORT RANKING ===
      if (customId === 'export_ranking') {
        try {
          await handlers[handlerName](interaction, client);
        } catch (err) {
          logger.error(err, '❌ Błąd podczas export_ranking');
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Wystąpił błąd podczas generowania pliku.', ephemeral: true });
          } else {
            await interaction.followUp({ content: '❌ Wystąpił błąd podczas generowania pliku.', ephemeral: true });
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
          logger.error(err, '❌ Błąd podczas liczenia punktów');
          await interaction.followUp('❌ Wystąpił błąd podczas przeliczania punktów.');
        }
        return;
      }

      // === Inne przyciski
      await handlers[handlerName](interaction, client);
      return;
    }

    // === MODAL SUBMIT ===
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;
      const handlerName = modalMap[customId];
      if (handlerName && handlers[handlerName]) {
        await handlers[handlerName](interaction, client);
      }
      return;
    }

    // === SELECT MENU (Dropdown) ===
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      // === HLTV: wybrano event z dropdownu ===
      if (customId === 'hltv_select_event') {
        return require('./handlers/hltvSelectEvent')(interaction);
      }

      // === RANKING (select menus, dwukropek) ===
      if (customId.startsWith('ranking:')) {
        const rankingCmd = require('./commands/ranking.js');
        return rankingCmd.handleComponent(interaction);
      }

      // Strict match
      if (selectMap[customId]) {
        const handlerName = selectMap[customId];
        if (handlers[handlerName]) return handlers[handlerName](interaction, client);
      }

      // Dynamic fallback do dropdownMap
      if (dropdownMap[customId]) {
        return require(`./handlers/${dropdownMap[customId]}`)(interaction, client);
      }

      // Fallback handler ogólny
      return require('./handlers/selectMenuHandler')(interaction, client);
    }

  } catch (err) {
    logger.error(err, '❌ Błąd ogólny w interactionCreate');
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Wystąpił błąd podczas obsługi interakcji.', ephemeral: true });
    }
  }
};
