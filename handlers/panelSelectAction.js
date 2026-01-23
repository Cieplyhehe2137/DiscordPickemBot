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

  // DANGER
  'danger:clearPicks': 'clear_db_confirm',
  'danger:clearOfficial': 'clear_only_results_confirm',
  'danger:fullReset': 'clear_db_with_results',
  'danger:clearMatches': 'clear_matches'
};

function resolveHandlerName(buttonMap, customId) {
  if (!buttonMap) return null;
  if (buttonMap[customId]) return buttonMap[customId];

  // bezpieczniej: najdłuższy pasujący klucz
  const key = Object.keys(buttonMap)
    .sort((a, b) => b.length - a.length)
    .find(k => customId.startsWith(k));

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
      .setCustomId(targetCustomId)
      .setLabel('✅ Potwierdzam')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('panel:danger:cancel')
      .setLabel('❌ Anuluj')
      .setStyle(ButtonStyle.Secondary),
  );
}

async function safeUpdate(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    }
    return await interaction.update(payload);
  } catch {
    return interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
  }
}

module.exports = async function panelSelectAction(interaction, client, handlers, maps) {
  try {
    const value = interaction.values?.[0];
    const targetCustomId = VALUE_TO_TARGET_CUSTOM_ID[value];

    if (!targetCustomId) {
      return interaction.reply({ content: '❌ Nieznana akcja.', ephemeral: true });
    }

    // === DANGER ===
    if (value.startsWith('danger:')) {
      return safeUpdate(interaction, {
        content: '⚠️ **Potwierdź operację (nieodwracalne)**:',
        components: [buildConfirmRow(targetCustomId)],
        ephemeral: true
      });
    }

    // === NORMAL ===
    const handlerName = resolveHandlerName(maps?.buttonMap, targetCustomId);
    const handler = handlers?.[handlerName];

    if (!handler) {
      logger.warn('interaction', 'panelSelectAction missing handler', {
        value,
        targetCustomId,
        handlerName
      });
      return interaction.reply({ content: '❌ Brak handlera dla tej akcji.', ephemeral: true });
    }

    await interaction.deferUpdate();

    const proxied = proxyCustomId(interaction, targetCustomId);
    await handler(proxied, client);

  } catch (err) {
    logger.error('interaction', 'panelSelectAction failed', {
      message: err.message,
      stack: err.stack
    });

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Błąd panelu.', ephemeral: true });
    }
  }
};
