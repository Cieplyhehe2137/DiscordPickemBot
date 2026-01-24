const logger = require('./utils/logger');
const { withGuild } = require('./utils/guildContext.js');

// =====================================================
// SAFE ACK
// =====================================================

async function safeDeferUpdate(interaction) {
  if (interaction.replied || interaction.deferred) return;
  try {
    await interaction.deferUpdate();
  } catch (_) {}
}

// =====================================================
// HANDLER RESOLVER
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
          (mod[handlerName] || mod.execute || mod.run || mod.handler || mod.default)) ||
        null;
    } catch (_) {
      fn = null;
    }
  }

  return typeof fn === 'function' ? fn : null;
}

// =====================================================
// CUSTOM ID NORMALIZATION
// =====================================================

function normalizeCustomId(customId) {
  return customId
    .replace(/_p\d+$/i, '')     // paginacja
    .replace(/^ranking:/, 'ranking_');
}

// =====================================================
// MAP RESOLVER
// =====================================================

function resolveByMap(customId, map) {
  const id = normalizeCustomId(customId);
  return (
    map[id] ||
    Object.keys(map).find(k => id.startsWith(k))
  );
}

// =====================================================
// GENERIC COMPONENT HANDLER
// =====================================================

async function handleComponent(interaction, client, handlers, map, type) {
  const customId = interaction.customId;
  const key = resolveByMap(customId, map);

  if (!key) {
    logger.warn('interaction', `Unhandled ${type}`, {
      guildId: interaction.guildId,
      customId,
    });
    await safeDeferUpdate(interaction);
    return;
  }

  const handlerName = map[key];
  const fn = resolveHandler(handlers, handlerName);

  if (!fn) {
    logger.error('interaction', `${type} handler not callable`, {
      guildId: interaction.guildId,
      customId,
      handlerName,
    });
    await safeDeferUpdate(interaction);
    return;
  }

  return fn(interaction, client, handlers);
}

// =====================================================
// INTERNAL ROUTER
// =====================================================

async function _handleInteraction(interaction, client, handlers = {}, maps = {}) {
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
    selectMap = {},
    modalMap = {},
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
      return handleComponent(
        interaction,
        client,
        handlers,
        buttonMap,
        'button'
      );
    }

    // ===== SELECT =====
    if (interaction.isStringSelectMenu()) {
      return handleComponent(
        interaction,
        client,
        handlers,
        selectMap,
        'select'
      );
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {
      return handleComponent(
        interaction,
        client,
        handlers,
        modalMap,
        'modal'
      );
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
          content: '❌ Wystąpił błąd podczas obsługi interakcji.',
          ephemeral: true,
        });
      } catch (_) {}
    }
  }
}

// =====================================================
// PUBLIC ENTRY
// =====================================================

module.exports = async function handleInteraction(interaction, client, handlers = {}, maps = {}) {
  if (!interaction.guildId) {
    logger.warn('interaction', 'Blocked interaction without guildId', {
      type: interaction.type,
      userId: interaction.user?.id,
      customId: interaction.customId,
    });
    return;
  }

  return withGuild(interaction.guildId, async () =>
    _handleInteraction(interaction, client, handlers, maps)
  );
};
