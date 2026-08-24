// handlers/panelSelectAction.js
const { logInfo, logWarn, logError } = require('../../utils/logger');
const isAdmin = require('../../utils/isAdmin');

const VALUE_TO_TARGET_CUSTOM_ID = {
  'results:export': 'export_ranking',
  'results:playin': 'set_results_playin',
  'results:swiss1': 'set_results_swiss_stage1',
  'results:swiss2': 'set_results_swiss_stage2',
  'results:swiss3': 'set_results_swiss_stage3',
  'results:playoffs': 'open_results_playoffs',
  'results:double': 'set_results_double',

  'matches:results': 'open_results_matches',
  'matches:add': 'add_match',
  'matches:clear': 'clear_matches',
  'matches:lock': 'match_lock_manager',

  'db:backup': 'backup_database',
  'db:restore': 'restore_backup',

  'danger:clearPicks': 'clear_db_confirm',
  'danger:clearOfficial': 'clear_only_results_confirm',
  'danger:fullReset': 'clear_db_with_results',
  'danger:clearMatches': 'clear_matches',
  'matches:undo_result': 'undo_match_result_open',
};

function proxyCustomId(interaction, forcedCustomId) {
  return new Proxy(interaction, {
    get(target, prop) {
      if (prop === 'customId') return forcedCustomId;

      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function resolveHandlerName(targetCustomId, maps) {
  const buttonMap = maps?.buttonMap || {};

  if (buttonMap[targetCustomId]) {
    return buttonMap[targetCustomId];
  }

  const matchedKey = Object.keys(buttonMap).find((key) =>
    targetCustomId.startsWith(key)
  );

  return matchedKey ? buttonMap[matchedKey] : null;
}

module.exports = async function panelSelectAction(
  interaction,
  client,
  handlers,
  maps
) {
  try {
    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: '⛔ Tylko administracja.',
        ephemeral: true,
      });
    }

    const value = interaction.values?.[0];

    logInfo('PANEL_SELECT_RECEIVED', {
      guildId: interaction.guildId,
      userId: interaction.user?.id || null,
      username: interaction.user?.tag || interaction.user?.username || null,
      customId: interaction.customId,
      extra: {
        value,
      },
    });

    const targetCustomId = VALUE_TO_TARGET_CUSTOM_ID[value];

    if (!targetCustomId) {
      logWarn('UNKNOWN_PANEL_SELECT_VALUE', {
        guildId: interaction.guildId,
        userId: interaction.user?.id || null,
        customId: interaction.customId,
        extra: {
          value,
        },
      });

      return interaction.reply({
        content: '❌ Nieznana akcja.',
        ephemeral: true,
      });
    }

    const handlerName = resolveHandlerName(targetCustomId, maps);

    if (!handlerName) {
      logError('NO_HANDLER_MAPPED_FOR_TARGET_CUSTOM_ID', null, {
        guildId: interaction.guildId,
        userId: interaction.user?.id || null,
        customId: interaction.customId,
        extra: {
          value,
          targetCustomId,
        },
      });

      return interaction.reply({
        content: '❌ Brak obsługi tej akcji.',
        ephemeral: true,
      });
    }

    const handler = handlers?.[handlerName];

    if (typeof handler !== 'function') {
      logError('HANDLER_NOT_LOADED_OR_INVALID', null, {
        guildId: interaction.guildId,
        userId: interaction.user?.id || null,
        customId: interaction.customId,
        extra: {
          value,
          targetCustomId,
          handlerName,
        },
      });

      return interaction.reply({
        content: '❌ Handler nie jest dostępny.',
        ephemeral: true,
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const proxiedInteraction = proxyCustomId(interaction, targetCustomId);

    logInfo('PANEL_SELECT_DISPATCHING_TO_HANDLER', {
      guildId: interaction.guildId,
      userId: interaction.user?.id || null,
      username: interaction.user?.tag || interaction.user?.username || null,
      customId: interaction.customId,
      extra: {
        value,
        targetCustomId,
        handlerName,
      },
    });

    await handler(proxiedInteraction, client);

    if (!interaction.replied && interaction.deferred) {
      await interaction.editReply({
        content: '✅ Akcja została wykonana.',
      });
    }
  } catch (err) {
    logError('PANEL_SELECT_ACTION_FAILED', err, {
      guildId: interaction.guildId,
      userId: interaction.user?.id || null,
      username: interaction.user?.tag || interaction.user?.username || null,
      customId: interaction.customId,
      extra: {
        values: interaction.values,
      },
    });

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Wystąpił błąd podczas wykonywania akcji.',
        });
      } else {
        await interaction.reply({
          content: '❌ Wystąpił błąd podczas wykonywania akcji.',
          ephemeral: true,
        });
      }
    } catch (_) {}
  }
};