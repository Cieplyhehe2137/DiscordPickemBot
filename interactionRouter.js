// interactionRouter.js
const logger = require('./utils/logger');
const { withGuild } = require('./utils/guildContext.js');

// Bezpieczny ACK dla button/select gdy brakuje handlera (żeby Discord nie pokazywał "Ta czynność się nie powiodła")
async function safeDeferUpdate(interaction) {
  if (interaction.replied || interaction.deferred) return;
  try {
    await interaction.deferUpdate();
  } catch (_) {
    // ignore
  }
}

function resolveHandler(handlers, handlerName) {
  let fn = handlers?.[handlerName];

  // jeśli loader zwrócił obiekt zamiast funkcji, spróbuj wyciągnąć callable
  if (fn && typeof fn === 'object') {
    fn = fn[handlerName] || fn.execute || fn.run || fn.handler || fn.default;
  }

  // jeśli nadal nie funkcja, spróbuj require pliku
  if (typeof fn !== 'function') {
    try {
      const mod = require(`./handlers/${handlerName}`);
      fn =
        (typeof mod === 'function' && mod) ||
        (mod &&
          typeof mod === 'object' &&
          (mod[handlerName] || mod.execute || mod.run || mod.handler || mod.default)) ||
        null;
    } catch (_) {
      fn = null;
    }
  }

  return typeof fn === 'function' ? fn : null;
}

async function _handleInteraction(interaction, client, handlers = {}, maps = {}) {
  const {
    buttonMap = {},
    modalMap = {},
    selectMap = {},
    dropdownMap = {},
  } = maps;

  try {
    logger.info('interaction', 'Interaction received', {
      guildId: interaction.guildId,
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

      // ranking (dwukropek)
      if (customId.startsWith('ranking:')) {
        const rankingCmd = require('./commands/ranking.js');
        return rankingCmd.handleComponent(interaction);
      }

      // legacy ranking_
      if (customId.startsWith('ranking_')) {
        const handler = require('./handlers/rankingPagination');
        return handler(interaction, client);
      }

      // Aliasowanie customId
      if (customId === 'clear_user_picks') customId = 'clear_db_confirm';
      if (customId === 'full_reset') customId = 'clear_db_with_results';
      if (customId === 'clear_official_results') customId = 'clear_only_results_confirm';

      // Legacy: część buttonów może iść przez dropdownMap (exact)
      if (dropdownMap?.[customId]) {
        const nameOrFile = dropdownMap[customId];
        const fn = handlers?.[nameOrFile] || require(`./handlers/${nameOrFile}`);
        return fn(interaction, client);
      }

      // Dopasowanie handlera (exact + prefix)
      const prefixKey = Object.keys(buttonMap).find((key) => customId.startsWith(key));
      let handlerName =
        buttonMap[customId] ||
        (prefixKey && buttonMap[prefixKey]) ||
        (customId?.startsWith('confirm_end_pickem') && 'confirmEndPickem') ||
        (customId?.startsWith('confirm_stage') && 'submitSwissDropdown');

      // Fallback dla clear_*
      if (!handlerName && customId?.startsWith('clear_')) {
        logger.warn('interaction', 'Fallback clearDatabaseHandler', { customId });
        handlerName = 'clearDatabaseHandler';
      }

      const fn = handlerName ? resolveHandler(handlers, handlerName) : null;

      if (!fn) {
        logger.warn('interaction', 'Unhandled button', { customId, handlerName });
        await safeDeferUpdate(interaction);
        return;
      }

      // EXPORT RANKING — osobny try/catch
      if (customId === 'export_ranking') {
        try {
          await fn(interaction, client);
        } catch (err) {
          logger.error('interaction', 'Export ranking failed', {
            message: err.message,
            stack: err.stack,
          });

          const payload = {
            content: '❌ Wystąpił błąd podczas generowania pliku.',
            ephemeral: true,
          };

          if (!interaction.replied && !interaction.deferred) await interaction.reply(payload);
          else await interaction.followUp(payload);
        }
        return;
      }

      // CALCULATE SCORES
      if (customId === 'calculate_scores') {
        await interaction.deferReply({ ephemeral: true });
        try {
          await fn(client);
          await interaction.followUp({ content: '✅ Punkty zostały przeliczone!', ephemeral: true });
        } catch (err) {
          logger.error('interaction', 'Calculate scores failed', {
            message: err.message,
            stack: err.stack,
          });
          await interaction.followUp({ content: '❌ Wystąpił błąd podczas przeliczania punktów.', ephemeral: true });
        }
        return;
      }

      // Inne przyciski
      await fn(interaction, client);
      return;
    }

    // === MODAL SUBMIT ===
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;
      const handlerName = modalMap?.[customId];
      const fn = handlerName ? resolveHandler(handlers, handlerName) : null;

      if (!fn) {
        logger.warn('interaction', 'Unhandled modal', { customId, handlerName });
        return;
      }

      await fn(interaction, client);
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

      // 1) selectMap (exact)
      if (selectMap?.[customId]) {
        const handlerName = selectMap[customId];
        const fn = handlerName ? resolveHandler(handlers, handlerName) : null;

        if (!fn) {
          logger.error('interaction', 'Select handler is not a function', {
            customId,
            handlerName,
            resolvedType: typeof handlers?.[handlerName],
          });
          await safeDeferUpdate(interaction);
          return;
        }

        // NOTE: zachowuję Twoje wywołanie z dodatkowymi parametrami
        return fn(interaction, client, handlers, maps);
      }

      // 2) dropdownMap (fix _p0/_p1)
      const baseId = customId.replace(/_p\d+$/i, '');
      const dropdownKey =
        (dropdownMap?.[customId] && customId) ||
        (dropdownMap?.[baseId] && baseId) ||
        Object.keys(dropdownMap || {}).find((k) => customId.startsWith(k)) ||
        Object.keys(dropdownMap || {}).find((k) => baseId.startsWith(k));

      if (dropdownKey) {
        const nameOrFile = dropdownMap[dropdownKey];
        const fn = handlers?.[nameOrFile] || require(`./handlers/${nameOrFile}`);
        return fn(interaction, client);
      }

      // 3) brak handlera -> ACK + log
      logger.warn('interaction', 'Unhandled select menu', { customId });
      await safeDeferUpdate(interaction);
      return;
    }

    // Inne typy interakcji (autocomplete itd.) – ignorujemy
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
}

module.exports = async function handleInteraction(interaction, client, handlers = {}, maps = {}) {
  // DM / brak guildId -> bez kontekstu
  if (!interaction.guildId) {
    return _handleInteraction(interaction, client, handlers, maps);
  }

  return withGuild(interaction.guildId, () => _handleInteraction(interaction, client, handlers, maps));
};
