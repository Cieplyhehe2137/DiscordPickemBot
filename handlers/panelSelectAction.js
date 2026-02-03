// handlers/panelSelectAction.js
const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');

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
  'danger:clearMatches': 'clear_matches'
};

function proxyCustomId(interaction, forcedCustomId) {
  const proxied = new Proxy(interaction, {
    get(target, prop) {
      if (prop === 'customId') return forcedCustomId;
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    }
  });

  // zachowanie kontekstu guild
  proxied.__guildContext = interaction.__guildContext;

  return proxied;
}

module.exports = async function panelSelectAction(interaction, client, handlers, maps) {
  try {
    // =========================
    // LOG 1: select dotarł
    // =========================
    logger.info('panel', 'Panel select received', {
      guildId: interaction.guildId,
      customId: interaction.customId,
      value: interaction.values?.[0],
    });

    const value = interaction.values?.[0];
    const targetCustomId = VALUE_TO_TARGET_CUSTOM_ID[value];

    // =========================
    // LOG 2: mapowanie value → customId
    // =========================
    if (!targetCustomId) {
      logger.warn('panel', 'No targetCustomId for select value', {
        value,
      });
      return;
    }

    logger.info('panel', 'Select mapped to targetCustomId', {
      value,
      targetCustomId,
    });

    const handlerName = maps?.buttonMap?.[targetCustomId];

    // =========================
    // LOG 3: handlerName z buttonMap
    // =========================
    if (!handlerName) {
      logger.warn('panel', 'No handlerName in buttonMap for targetCustomId', {
        targetCustomId,
      });
      return;
    }

    const handler = handlers?.[handlerName];

    // =========================
    // LOG 4: handler znaleziony
    // =========================
    if (!handler) {
      logger.error('panel', 'Handler not loaded', {
        handlerName,
        targetCustomId,
      });
      return;
    }

    logger.info('panel', 'Dispatching to handler', {
      handlerName,
      targetCustomId,
    });

    const proxied = proxyCustomId(interaction, targetCustomId);

    // =========================
    // LOG 5: przed wywołaniem handlera
    // =========================
    logger.info('panel', 'Calling handler', {
      handlerName,
      guildId: proxied.guildId,
      customId: proxied.customId,
    });

    // ❗ tu NAJPEWNIEJ leci error / timeout
    await handler(proxied, client);

    // =========================
    // LOG 6: handler zakończył się
    // =========================
    logger.info('panel', 'Handler finished successfully', {
      handlerName,
    });

  } catch (err) {
    logger.error('panel', 'panelSelectAction failed', {
      message: err.message,
      stack: err.stack,
    });
  }
};
