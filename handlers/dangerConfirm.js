// handlers/dangerConfirm.js
const logger = require('../utils/logger');

function getFromMap(mapLike, key) {
  if (!mapLike) return null;
  if (typeof mapLike.get === 'function') return mapLike.get(key) || null;
  return mapLike[key] || null;
}

const CONFIRM_TO_OLD_CUSTOM_ID = {
  'danger:confirm:clear_user_picks': 'clear_user_picks',
  'danger:confirm:clear_official_results': 'clear_official_results',
  'danger:confirm:full_reset': 'full_reset',
};

module.exports = async function dangerConfirm(interaction, client, maps) {
  try {
    const oldCustomId = CONFIRM_TO_OLD_CUSTOM_ID[interaction.customId];
    if (!oldCustomId) {
      return interaction.reply({ content: '❌ Nieznana operacja.', ephemeral: true });
    }

    const handler = getFromMap(maps?.buttonMap, oldCustomId);
    if (!handler) {
      logger.error('interaction', 'No handler for danger confirm', { oldCustomId });
      return interaction.reply({ content: `❌ Brak handlera dla: ${oldCustomId}`, ephemeral: true });
    }

    // tutaj możesz jeszcze np. interaction.update(...) wyczyścić confirm UI,
    // ale znowu: zostawiamy to handlerowi, żeby nie blokować modali
    await handler(interaction, client, maps);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '✅ Wykonano.', ephemeral: true });
    }
  } catch (err) {
    logger.error('interaction', 'dangerConfirm failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Coś poszło nie tak.', ephemeral: true });
    }
  }
};
