// interactionRouter.js
const logger = require('./utils/logger');
const { withGuild } = require('./utils/guildContext.js');

// =====================================================
// Bezpieczny ACK dla button/select gdy brakuje handlera
// =====================================================
async function safeDeferUpdate(interaction) {
  if (interaction.replied || interaction.deferred) return;
  try {
    await interaction.deferUpdate();
  } catch (_) {
    // ignore
  }
}

// =====================================================
// Handler resolver
// =====================================================
function resolveHandler(handlers, handlerName) {
  let fn = handlers?.[handlerName];

  if (fn && typeof fn === 'object') {
    fn = fn[handlerName] || fn.execute || fn.run || fn.handler || fn.default;
  }

  if (typeof fn !== 'function') {
    try {
      const mod = require(`./handlers/${handlerName}`);
      fn =
        (typeof mod === 'function' && mod) ||
        (mod &&
          typeof mod === 'object' &&
          (mod[handlerName] ||
            mod.execute ||
            mod.run ||
            mod.handler ||
            mod.default)) ||
        null;
    } catch (_) {
      fn = null;
    }
  }

  return typeof fn === 'function' ? fn : null;
}

// =====================================================
// Internal handler
// =====================================================
async function _handleInteraction(interaction, client, handlers = {}, maps = {}) {
  // 🔒 HARD GUARD — nigdy bez guild
  if (!interaction.guildId) {
    logger.warn('interaction', 'Interaction without guildId blocked', {
      type: interaction.type,
      userId: interaction.user?.id,
      customId: interaction.customId,
    });
    return;
  }

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

    // ===== SLASH COMMAND =====
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction);
      return;
    }

    // ===== BUTTON =====
    if (interaction.isButton()) {
      let customId = interaction.customId;

      if (customId.startsWith('ranking:')) {
        const rankingCmd = require('./commands/ranking.js');
        return rankingCmd.handleComponent(interaction);
      }

      if (customId.startsWith('ranking_')) {
        const handler = require('./handlers/rankingPagination');
        return handler(interaction, client);
      }

      if (customId === 'clear_user_picks') customId = 'clear_db_confirm';
      if (customId === 'full_reset') customId = 'clear_db_with_results';
      if (customId === 'clear_official_results')
        customId = 'clear_only_results_confirm';

      if (dropdownMap?.[customId]) {
        const nameOrFile = dropdownMap[customId];
        const fn =
          handlers?.[nameOrFile] ||
          require(`./handlers/${nameOrFile}`);
        return fn(interaction, client);
      }

      const prefixKey = Object.keys(buttonMap).find((key) =>
        customId.startsWith(key),
      );

      let handlerName =
        buttonMap[customId] ||
        (prefixKey && buttonMap[prefixKey]) ||
        (customId?.startsWith('confirm_end_pickem') &&
          'confirmEndPickem') ||
        (customId?.startsWith('confirm_stage') &&
          'submitSwissDropdown');

      if (!handlerName && customId?.startsWith('clear_')) {
        logger.warn('interaction', 'Fallback clearDatabaseHandler', {
          guildId: interaction.guildId,
          customId,
        });
        handlerName = 'clearDatabaseHandler';
      }

      const fn = handlerName
        ? resolveHandler(handlers, handlerName)
        : null;

      if (!fn) {
        logger.warn('interaction', 'Unhandled button', {
          guildId: interaction.guildId,
          customId,
          handlerName,
        });
        await safeDeferUpdate(interaction);
        return;
      }

      if (customId === 'export_ranking') {
        try {
          await fn(interaction, client);
        } catch (err) {
          logger.error('interaction', 'Export ranking failed', {
            guildId: interaction.guildId,
            message: err.message,
            stack: err.stack,
          });

          const payload = {
            content: '❌ Wystąpił błąd podczas generowania pliku.',
            ephemeral: true,
          };

          if (!interaction.replied && !interaction.deferred)
            await interaction.reply(payload);
          else await interaction.followUp(payload);
        }
        return;
      }

      if (customId === 'calculate_scores') {
        await interaction.deferReply({ ephemeral: true });
        try {
          await fn(interaction.guildId);
          await interaction.followUp({
            content: '✅ Punkty zostały przeliczone!',
            ephemeral: true,
          });
        } catch (err) {
          logger.error('interaction', 'Calculate scores failed', {
            guildId: interaction.guildId,
            message: err.message,
            stack: err.stack,
          });
          await interaction.followUp({
            content:
              '❌ Wystąpił błąd podczas przeliczania punktów.',
            ephemeral: true,
          });
        }
        return;
      }

      await fn(interaction, client);
      return;
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {
      const handlerName = modalMap?.[interaction.customId];
      const fn = handlerName
        ? resolveHandler(handlers, handlerName)
        : null;

      if (!fn) {
        logger.warn('interaction', 'Unhandled modal', {
          guildId: interaction.guildId,
          customId: interaction.customId,
        });
        return;
      }

      await fn(interaction, client);
      return;
    }

    // ===== SELECT =====
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      if (customId.startsWith('ranking:')) {
        const rankingCmd = require('./commands/ranking.js');
        return rankingCmd.handleComponent(interaction);
      }

      if (selectMap?.[customId]) {
        const handlerName = selectMap[customId];
        const fn = handlerName
          ? resolveHandler(handlers, handlerName)
          : null;

        if (!fn) {
          logger.error('interaction', 'Select handler not callable', {
            guildId: interaction.guildId,
            customId,
            handlerName,
          });
          await safeDeferUpdate(interaction);
          return;
        }

        return fn(interaction, client, handlers, maps);
      }

      const baseId = customId.replace(/_p\d+$/i, '');
      const dropdownKey =
        dropdownMap?.[customId] ||
        dropdownMap?.[baseId] ||
        Object.keys(dropdownMap || {}).find((k) =>
          customId.startsWith(k),
        ) ||
        Object.keys(dropdownMap || {}).find((k) =>
          baseId.startsWith(k),
        );

      if (dropdownKey) {
        const nameOrFile = dropdownMap[dropdownKey];
        const fn =
          handlers?.[nameOrFile] ||
          require(`./handlers/${nameOrFile}`);
        return fn(interaction, client);
      }

      logger.warn('interaction', 'Unhandled select menu', {
        guildId: interaction.guildId,
        customId,
      });
      await safeDeferUpdate(interaction);
    }
  } catch (err) {
    logger.error('interaction', 'Unhandled interactionCreate error', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack,
    });

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content:
            '❌ Wystąpił błąd podczas obsługi interakcji.',
          ephemeral: true,
        });
      } catch (_) {}
    }
  }
}

// =====================================================
// Public entry
// =====================================================
module.exports = async function handleInteraction(
  interaction,
  client,
  handlers = {},
  maps = {},
) {
  if (!interaction.guildId) {
    logger.warn('interaction', 'Blocked interaction without guildId', {
      type: interaction.type,
      userId: interaction.user?.id,
      customId: interaction.customId,
    });
    return;
  }

  return withGuild(interaction.guildId, async () =>
    _handleInteraction(interaction, client, handlers, maps),
  );
};
