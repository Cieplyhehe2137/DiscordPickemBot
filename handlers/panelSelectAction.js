// handlers/panelSelectAction.js
const { logInfo, logWarn, logError } = require('../utils/logger');

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

  'db:backup': 'backup_database',
  'db:restore': 'restore_backup',

  'danger:clearPicks': 'clear_db_confirm',
  'danger:clearOfficial': 'clear_only_results_confirm',
  'danger:fullReset': 'clear_db_with_results',
  'danger:clearMatches': 'clear_matches',
};

function proxyCustomId(interaction, forcedCustomId) {
  return new Proxy(interaction, {
    get(target, prop) {
      if (prop === 'customId') return forcedCustomId;
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

module.exports = async function panelSelectAction(
  interaction,
  client,
  handlers,
  maps,
) {
  try {
    const value = interaction.values?.[0];

    logInfo('panel', 'Panel select received', {
      guildId: interaction.guildId,
      customId: interaction.customId,
      value,
    });

    const targetCustomId = VALUE_TO_TARGET_CUSTOM_ID[value];
    if (!targetCustomId) {
      logWarn('panel', 'Unknown select value', { value });
      return interaction.reply({
        content: '❌ Nieznana akcja.',
        ephemeral: true,
      });
    }

    const handlerName =
      maps?.buttonMap?.[targetCustomId] ||
      Object.keys(maps?.buttonMap || {}).find(key =>
        targetCustomId.startsWith(key)
      ) && maps.buttonMap[
      Object.keys(maps.buttonMap).find(key =>
        targetCustomId.startsWith(key)
      )
      ];
    if (!handlerName) {
      logError('panel', 'No handler mapped for targetCustomId', {
        targetCustomId,
      });
      return interaction.reply({
        content: '❌ Brak obsługi tej akcji.',
        ephemeral: true,
      });
    }

    const handler = handlers?.[handlerName];
    if (typeof handler !== 'function') {
      logError('panel', 'Handler not loaded or invalid', {
        handlerName,
      });
      return interaction.reply({
        content: '❌ Handler nie jest dostępny.',
        ephemeral: true,
      });
    }

    // 🔑 ZAWSZE ACK DLA SELECTA (ephemeral)
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const proxied = proxyCustomId(interaction, targetCustomId);

    logInfo('panel', 'Dispatching select to handler', {
      handlerName,
      targetCustomId,
    });

    await handler(proxied, client);

    // ⚠️ Jeśli handler NIC nie zrobił → pokaż fallback
    if (!interaction.replied) {
      await interaction.editReply({
        content: '✅ Akcja została wykonana.',
      });
    }

  } catch (err) {
    logError('panel', 'panelSelectAction failed', {
      message: err.message,
      stack: err.stack,
    });

    if (!interaction.replied) {
      try {
        await interaction.editReply({
          content: '❌ Wystąpił błąd podczas wykonywania akcji.',
        });
      } catch (_) { }
    }
  }
};
