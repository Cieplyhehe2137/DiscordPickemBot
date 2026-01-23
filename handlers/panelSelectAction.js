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

function resolveHandlerName(map, customId) {
  return map?.[customId] || null;
}

function proxyCustomId(interaction, forcedCustomId) {
  const proxied = new Proxy(interaction, {
    get(target, prop) {
      if (prop === 'customId') return forcedCustomId;
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    }
  });

  // 🔑 KLUCZOWA LINIA
  proxied.__guildContext = interaction.__guildContext;

  return proxied;
}


module.exports = async function panelSelectAction(interaction, client, handlers, maps) {
  try {
    const value = interaction.values?.[0];
    const targetCustomId = VALUE_TO_TARGET_CUSTOM_ID[value];

    if (!targetCustomId) {
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: '❌ Nieznana akcja.',
          ephemeral: true
        });
      }
      return;
    }

    const handlerName = resolveHandlerName(maps?.buttonMap, targetCustomId);
    const handler = handlers?.[handlerName];

    if (!handler) {
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: '❌ Brak handlera dla tej akcji.',
          ephemeral: true
        });
      }
      return;
    }

    const proxied = proxyCustomId(interaction, targetCustomId);

    // ❗ ZERO deferReply TUTAJ
    await handler(proxied, client);

  } catch (err) {
    logger.error('panel', 'panelSelectAction failed', {
      message: err.message,
      stack: err.stack
    });

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Błąd panelu.',
        ephemeral: true
      });
    }
  }
};
