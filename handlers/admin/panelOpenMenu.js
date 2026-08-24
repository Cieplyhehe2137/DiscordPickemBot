const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits
} = require('discord.js');

const { logInfo, logWarn, logError } = require('../../utils/logger');

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function buildMenu(customId) {
  switch (customId) {

    case 'panel:open:results':
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
          { label: 'Wyniki Play-In', value: 'results:playin', emoji: '📄' }
        );

    case 'panel:open:matches':
      return new StringSelectMenuBuilder()
        .setCustomId('panel:select:matches')
        .setPlaceholder('Wybierz: Mecze')
        .addOptions(
          {
            label: 'Wyniki meczów',
            value: 'matches:results',
            emoji: '🎯'
          },
          {
            label: 'Edytuj mecz',
            value: 'matches:edit',
            emoji: '✏️'
          },
          {
            label: 'Cofnij wynik meczu',
            value: 'matches:undo_result',
            emoji: '↩️'
          },
          {
            label: 'Blokada / odblokowanie meczu',
            value: 'matches:lock',
            emoji: '🔐'
          },
          {
            label: 'Dodaj mecz',
            value: 'matches:add',
            emoji: '➕'
          },
          {
            label: 'Wyczyść mecze fazy',
            value: 'matches:clear',
            emoji: '🧹'
          }
        );
    case 'panel:open:db':
      return new StringSelectMenuBuilder()
        .setCustomId('panel:select:db')
        .setPlaceholder('Wybierz: Baza danych')
        .addOptions(
          { label: 'Backup bazy', value: 'db:backup', emoji: '💾' },
          { label: 'Przywróć bazę', value: 'db:restore', emoji: '♻️' }
        );

    case 'panel:open:danger':
      return new StringSelectMenuBuilder()
        .setCustomId('panel:select:danger')
        .setPlaceholder('⚠️ Operacje nieodwracalne')
        .addOptions(
          { label: 'Wyczyść typy userów', value: 'danger:clearPicks', emoji: '✏️' },
          { label: 'Wyczyść tylko oficjalne wyniki', value: 'danger:clearOfficial', emoji: '🗑️' },
          { label: 'Pełny reset', value: 'danger:fullReset', emoji: '💣' },
          { label: 'Usuń ustawione mecze (faza)', value: 'danger:clearMatches', emoji: '🧹' }
        );

    default:
      return null;
  }
}

module.exports = async function panelOpenMenu(interaction) {
  try {
    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: '⛔ Tylko administracja.',
        ephemeral: true
      });
    }

    /* =======================================================
       1️⃣ BUTTON → WYŚWIETL DROPDOWN
    ======================================================= */
    if (interaction.isButton()) {

      const menu = buildMenu(interaction.customId);
      if (!menu) return;

      const row = new ActionRowBuilder().addComponents(menu);

      return interaction.reply({
        content: 'Wybierz akcję:',
        components: [row],
        ephemeral: true
      });
    }

    /* =======================================================
       2️⃣ SELECT → PRZEKIEROWANIE
    ======================================================= */
    if (interaction.isStringSelectMenu()) {

      const value = interaction.values?.[0];
      if (!value) {
        return interaction.deferUpdate();
      }

      // ===== RESULTS =====
      if (value === 'results:export') {
        return interaction.reply({
          content: '➡️ Uruchamiam eksport...',
          ephemeral: true
        });
      }

      if (value === 'results:swiss1') {
        return require('../swiss/openSwissResultsDropdown')(interaction, 'stage1');
      }

      if (value === 'results:swiss2') {
        return require('../swiss/openSwissResultsDropdown')(interaction, 'stage2');
      }

      if (value === 'results:swiss3') {
        return require('../swiss/openSwissResultsDropdown')(interaction, 'stage3');
      }

      if (value === 'results:playoffs') {
        return require('../playoffs/openPlayoffsResultsDropdown')(interaction);
      }

      if (value === 'results:double') {
        return require('../doubleelim/openDoubleElimResultsDropdown')(interaction);
      }

      if (value === 'results:playin') {
        return require('../playin/openPlayinResultsDropdown')(interaction);
      }

      // ===== MATCHES =====
      if (value === 'matches:results') {
        return require('../matches/openMatchResults')(interaction);
      }

      if (value === 'matches:add') {
        return require('../matches/openAddMatch')(interaction);
      }

      if (value === 'matches:clear') {
        return require('../matches/openClearMatches')(interaction);
      }

      // ===== DB =====
      if (value === 'db:backup') {
        return require('./backupDatabase')(interaction);
      }

      if (value === 'db:restore') {
        return require('./restoreBackupSelector')(interaction);
      }

      // ===== DANGER =====
      if (value === 'danger:clearPicks') {
        interaction.customId = 'clear_user_picks';
        return require('./clearDatabaseHandler')(interaction);
      }

      if (value === 'danger:clearOfficial') {
        interaction.customId = 'clear_only_results_confirm';
        return require('./clearDatabaseHandler')(interaction);
      }

      if (value === 'danger:fullReset') {
        interaction.customId = 'full_reset';
        return require('./clearDatabaseHandler')(interaction);
      }

      if (value === 'danger:clearMatches') {
        return require('../matches/openClearMatches')(interaction);
      }

      return interaction.deferUpdate();
    }

  } catch (err) {
    logError('interaction', 'panelOpenMenu failed', {
      message: err.message,
      stack: err.stack
    });

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: '❌ Błąd panelu.',
        ephemeral: true
      });
    }
  }
};