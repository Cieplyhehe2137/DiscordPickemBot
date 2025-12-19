// handlers/clearDatabaseHandler.js
const pool = require('../db.js');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const logger = require('../utils/logger');

module.exports = async (interaction) => {
  if (!interaction.isButton()) return;

  const userMeta = {
    userId: interaction.user.id,
    username: interaction.user.tag,
    customId: interaction.customId
  };

  // 🔥 START — każda próba
  logger.warn("clear", "Clear database interaction triggered", userMeta);

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }
  } catch (_) {}

  const aliasMap = {
    clear_user_picks: 'clear_db_confirm',
    full_reset: 'clear_db_with_results',
    clear_official_results: 'clear_only_results_confirm',
  };

  const rawId = interaction.customId || '';
  const action = aliasMap[rawId] || rawId;

  async function safeFollowUp(payload) {
    try {
      return await interaction.followUp({ ephemeral: true, ...payload });
    } catch (_) {
      try {
        return await interaction.followUp({
          ephemeral: true,
          content: '❌ Wystąpił błąd.'
        });
      } catch (_) {}
    }
  }

  // === CONFIRMY ===
  if (action === 'clear_db_confirm') {
    logger.warn("clear", "Clear DB confirm requested", userMeta);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('clear_db_yes').setLabel('✅ Tak, wyczyść').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('clear_db_no').setLabel('❌ Nie, anuluj').setStyle(ButtonStyle.Secondary),
    );

    return safeFollowUp({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑 Czy na pewno chcesz wyczyścić bazę?')
          .setDescription('Ta operacja usunie **wszystkie typy użytkowników**.')
          .setColor(0xffcc00)
      ],
      components: [row]
    });
  }

  // === AKCJE KASUJĄCE ===
  if (action === 'clear_db_yes') {
    logger.warn("clear", "Executing USER PICKS cleanup", userMeta);

    try {
      await pool.query(`DELETE FROM swiss_predictions`);
      await pool.query(`DELETE FROM playoffs_predictions`);
      await pool.query(`DELETE FROM doubleelim_predictions`);
      await pool.query(`DELETE FROM playin_predictions`);
      await pool.query(`DELETE FROM swiss_scores`);
      await pool.query(`DELETE FROM playoffs_scores`);
      await pool.query(`DELETE FROM doubleelim_scores`);
      await pool.query(`DELETE FROM playin_scores`);

      logger.info("clear", "User picks cleared successfully", userMeta);

      await safeFollowUp({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff88)
            .setTitle('🧹 Baza wyczyszczona')
            .setDescription('Usunięto **wszystkie typy użytkowników**.')
        ]
      });
    } catch (err) {
      logger.error("clear", "Failed to clear user picks", {
        ...userMeta,
        message: err.message,
        stack: err.stack
      });

      await safeFollowUp({ content: '❌ Błąd podczas czyszczenia typów.' });
    }
    return;
  }

  if (action === 'clear_all_yes') {
    logger.warn("clear", "Executing FULL DATABASE RESET", userMeta);

    try {
      await pool.query(`DELETE FROM swiss_predictions`);
      await pool.query(`DELETE FROM playoffs_predictions`);
      await pool.query(`DELETE FROM doubleelim_predictions`);
      await pool.query(`DELETE FROM playin_predictions`);
      await pool.query(`DELETE FROM active_panels`);
      await pool.query(`DELETE FROM swiss_results`);
      await pool.query(`DELETE FROM playoffs_results`);
      await pool.query(`DELETE FROM doubleelim_results`);
      await pool.query(`DELETE FROM playin_results`);
      await pool.query(`DELETE FROM swiss_scores`);
      await pool.query(`DELETE FROM playoffs_scores`);
      await pool.query(`DELETE FROM doubleelim_scores`);
      await pool.query(`DELETE FROM playin_scores`);

      logger.info("clear", "FULL database reset completed", userMeta);

      await safeFollowUp({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🧹 PEŁNY RESET')
            .setDescription('Usunięto **wszystko**: typy i oficjalne wyniki.')
        ]
      });
    } catch (err) {
      logger.error("clear", "FULL database reset failed", {
        ...userMeta,
        message: err.message,
        stack: err.stack
      });

      await safeFollowUp({ content: '❌ Błąd podczas pełnego resetu bazy.' });
    }
    return;
  }

  if (action === 'clear_only_results_yes') {
    logger.warn("clear", "Executing OFFICIAL RESULTS cleanup", userMeta);

    try {
      await pool.query(`DELETE FROM swiss_results`);
      await pool.query(`DELETE FROM playoffs_results`);
      await pool.query(`DELETE FROM doubleelim_results`);
      await pool.query(`DELETE FROM playin_results`);
      await pool.query(`DELETE FROM swiss_scores`);
      await pool.query(`DELETE FROM playoffs_scores`);
      await pool.query(`DELETE FROM doubleelim_scores`);
      await pool.query(`DELETE FROM playin_scores`);

      logger.info("clear", "Official results cleared", userMeta);

      await safeFollowUp({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('🧹 Usunięto oficjalne wyniki')
            .setDescription('Typy użytkowników pozostały bez zmian.')
        ]
      });
    } catch (err) {
      logger.error("clear", "Failed to clear official results", {
        ...userMeta,
        message: err.message,
        stack: err.stack
      });

      await safeFollowUp({ content: '❌ Błąd podczas usuwania oficjalnych wyników.' });
    }
    return;
  }

  if (action === 'clear_db_no' || action === 'clear_all_no' || action === 'clear_only_results_no') {
    logger.info("clear", "Clear database action cancelled", userMeta);
    return safeFollowUp({ content: '✅ Anulowano.' });
  }

  return;
};
