// handlers/panelOpenMenu.js
const { ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function buildMenu(customId) {
  if (customId === 'panel:open:results') {
    return new StringSelectMenuBuilder()
      .setCustomId('panel:select:results')
      .setPlaceholder('Wybierz: Wyniki / Eksport')
      .addOptions(
        { label: 'Eksport klasyfikacji', value: 'results:export', emoji: '📁' },
        { label: 'Swiss — Stage 1', value: 'results:swiss1', emoji: '📑' },
        { label: 'Swiss — Stage 2', value: 'results:swiss2', emoji: '📑' },
        { label: 'Swiss — Stage 3', value: 'results:swiss3', emoji: '📑' },
        { label: 'Wyniki Playoffs', value: 'results:playoffs', emoji: '🏆' },
        { label: 'Wyniki Double Elim', value: 'results:double', emoji: '🔁' },
        { label: 'Wyniki Play-In', value: 'results:playin', emoji: '📄' },
      );
  }

  if (customId === 'panel:open:matches') {
    return new StringSelectMenuBuilder()
      .setCustomId('panel:select:matches')
      .setPlaceholder('Wybierz: Mecze')
      .addOptions(
        { label: 'Wyniki meczów', value: 'matches:results', emoji: '🎯' },
        { label: 'Dodaj mecz', value: 'matches:add', emoji: '➕' },
        { label: 'Wyczyść mecze fazy', value: 'matches:clear', emoji: '🧹' },
      );
  }

  if (customId === 'panel:open:db') {
    return new StringSelectMenuBuilder()
      .setCustomId('panel:select:db')
      .setPlaceholder('Wybierz: Baza danych')
      .addOptions(
        { label: 'Backup bazy', value: 'db:backup', emoji: '💾' },
        { label: 'Przywróć bazę', value: 'db:restore', emoji: '♻️' },
      );
  }

  if (customId === 'panel:open:danger') {
    return new StringSelectMenuBuilder()
      .setCustomId('panel:select:danger')
      .setPlaceholder('Uwaga: operacje nieodwracalne')
      .addOptions(
        { label: 'Wyczyść typy userów', value: 'danger:clearPicks', emoji: '✏️' },
        { label: 'Wyczyść tylko oficjalne wyniki', value: 'danger:clearOfficial', emoji: '🗑️' },
        { label: 'Pełny reset (łącznie z wynikami)', value: 'danger:fullReset', emoji: '💣' },
      );
  }

  return null;
}

module.exports = async function panelOpenMenu(interaction) {
  try {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
    }

    const menu = buildMenu(interaction.customId);
    if (!menu) return;

    const row = new ActionRowBuilder().addComponents(menu);
    return interaction.reply({ content: 'Wybierz akcję:', components: [row], ephemeral: true });
  } catch (err) {
    logger.error('interaction', 'panelOpenMenu failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Błąd panelu.', ephemeral: true });
    }
  }
};
