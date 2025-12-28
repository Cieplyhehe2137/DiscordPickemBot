// handlers/panelSelectAction.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

  // DANGER -> stare customId (klikane dopiero w potwierdzeniu)
  'danger:clearPicks': 'clear_db_confirm',
  'danger:clearOfficial': 'clear_only_results_confirm',
  'danger:fullReset': 'clear_db_with_results',
  'danger:clearMatches': 'clear_matches'
};

function resolveHandlerName(buttonMap, customId) {
  if (buttonMap?.[customId]) return buttonMap[customId];
  const key = Object.keys(buttonMap || {}).find(k => customId.startsWith(k));
  return key ? buttonMap[key] : null;
}

function proxyCustomId(interaction, forcedCustomId) {
  return new Proxy(interaction, {
    get(target, prop) {
      if (prop === 'customId') return forcedCustomId;
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    }
  });
}

function buildConfirmRow(targetCustomId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(targetCustomId) // <-- klucz: tu idzie STARE customId jako button
      .setLabel('✅ Potwierdzam')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('panel:danger:cancel')
      .setLabel('❌ Anuluj')
      .setStyle(ButtonStyle.Secondary),
  );
}

module.exports = async function panelSelectAction(interaction, client, handlers, maps) {
  try {
    const value = interaction.values?.[0];
    const targetCustomId = VALUE_TO_TARGET_CUSTOM_ID[value];

    if (!targetCustomId) {
      return interaction.reply({ content: '❌ Nieznana akcja.', ephemeral: true });
    }

    // === DANGER: pokazujemy potwierdzenie zamiast wykonywać od razu ===
    if (value.startsWith('danger:')) {
      return interaction.update({
        content: '⚠️ Potwierdź operację (nieodwracalne):',
        components: [buildConfirmRow(targetCustomId)]
      });
    }

    // === NORMAL: odpalamy stary handler (jakby to był button) ===
    const handlerName = resolveHandlerName(maps?.buttonMap, targetCustomId);
    if (!handlerName || !handlers?.[handlerName]) {
      logger.warn('interaction', 'panelSelectAction missing handler', { value, targetCustomId, handlerName });
      return interaction.reply({ content: '❌ Brak handlera dla tej akcji.', ephemeral: true });
    }

    const proxied = proxyCustomId(interaction, targetCustomId);
    await handlers[handlerName](proxied, client);

  } catch (err) {
    logger.error('interaction', 'panelSelectAction failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Błąd panelu.', ephemeral: true });
    }
  }
};
