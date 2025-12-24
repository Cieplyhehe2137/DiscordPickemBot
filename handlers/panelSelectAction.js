// handlers/panelSelectAction.js
const logger = require('../utils/logger');

const VALUE_TO_TARGET_CUSTOM_ID = {
  // Wyniki / eksport
  'results:export': 'export_ranking',
  'results:playin': 'set_results_playin',
  'results:swiss1': 'set_results_swiss_stage1',
  'results:swiss2': 'set_results_swiss_stage2',
  'results:swiss3': 'set_results_swiss_stage3',
  'results:playoffs': 'open_results_playoffs',
  'results:double': 'set_results_double',

  // Mecze
  'matches:results': 'open_results_matches',
  'matches:add': 'add_match',
  'matches:clear': 'clear_matches',

  // DB
  'db:backup': 'backup_database',
  'db:restore': 'restore_backup',

  // DANGER -> Twoje “confirm” customId (żeby zawsze było potwierdzenie)
  'danger:clearPicks': 'clear_db_confirm',
  'danger:clearOfficial': 'clear_only_results_confirm',
  'danger:fullReset': 'clear_db_with_results',
};

function resolveHandlerName(buttonMap, customId) {
  if (buttonMap?.[customId]) return buttonMap[customId];

  const key = Object.keys(buttonMap || {}).find(k => customId.startsWith(k));
  if (key) return buttonMap[key];

  return null;
}

function makeInteractionProxyWithCustomId(interaction, forcedCustomId) {
  // Proxy: customId zwraca forcedCustomId, metody bindowane do oryginału
  return new Proxy(interaction, {
    get(target, prop) {
      if (prop === 'customId') return forcedCustomId;
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    }
  });
}

module.exports = async function panelSelectAction(interaction, client, handlers, maps) {
  try {
    const value = interaction.values?.[0];
    const targetCustomId = VALUE_TO_TARGET_CUSTOM_ID[value];

    if (!targetCustomId) {
      return interaction.reply({ content: '❌ Nieznana akcja.', ephemeral: true });
    }

    const handlerName = resolveHandlerName(maps?.buttonMap, targetCustomId);
    if (!handlerName || !handlers?.[handlerName]) {
      logger.warn('interaction', 'panelSelectAction missing handler', { value, targetCustomId, handlerName });
      return interaction.reply({ content: '❌ Brak handlera dla tej akcji.', ephemeral: true });
    }

    const proxy = makeInteractionProxyWithCustomId(interaction, targetCustomId);

    // UWAGA: nie robimy interaction.update(), bo część Twoich handlerów odpala modale
    await handlers[handlerName](proxy, client);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '✅ OK.', ephemeral: true });
    }
  } catch (err) {
    logger.error('interaction', 'panelSelectAction failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Błąd panelu.', ephemeral: true });
    }
  }
};
