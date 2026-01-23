const db = require('../db.js');
const isAdmin = require('../utils/isAdmin');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const logger = require('../utils/logger');
const { safeQuery } = require('../utils/safeQuery');

module.exports = async (interaction) => {
  if (!interaction.isButton()) return;

  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true,
    });
  }

  // 🔒 ADMIN ONLY
  if (!isAdmin(interaction)) {
    logger.warn('clear', 'Unauthorized clear attempt', {
      guild_id: guildId,
      userId: interaction.user.id,
      customId: interaction.customId,
    });

    return interaction.reply({
      content: '❌ Brak uprawnień do tej operacji.',
      ephemeral: true,
    });
  }

  const pool = db.getPoolForGuild(guildId);

  const userMeta = {
    guild_id: guildId,
    userId: interaction.user.id,
    username: interaction.user.tag,
    customId: interaction.customId,
  };

  logger.warn('clear', 'Clear database interaction triggered', userMeta);

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

  const action = aliasMap[interaction.customId] || interaction.customId;

  async function safeFollowUp(payload) {
    try {
      return await interaction.followUp({ ephemeral: true, ...payload });
    } catch (_) {
      try {
        return await interaction.followUp({
          ephemeral: true,
          content: '❌ Wystąpił błąd.',
        });
      } catch (_) {}
    }
  }

  // =========================
  // CONFIRMS
  // =========================

  if (action === 'clear_db_confirm') {
    return safeFollowUp({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑 Czy na pewno chcesz wyczyścić bazę?')
          .setDescription('Usunie **wszystkie typy użytkowników**.')
          .setColor(0xffcc00),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('clear_db_yes')
            .setLabel('✅ Tak')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('clear_db_no')
            .setLabel('❌ Nie')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
  }

  if (action === 'clear_db_with_results') {
    return safeFollowUp({
      embeds: [
        new EmbedBuilder()
          .setTitle('💣 PEŁNY RESET — na pewno?')
          .setDescription('Usunie **typy + wyniki + score**.')
          .setColor(0xff0000),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('clear_all_yes')
            .setLabel('✅ Tak')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('clear_all_no')
            .setLabel('❌ Nie')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
  }

  if (action === 'clear_only_results_confirm') {
    return safeFollowUp({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑 Usunąć tylko oficjalne wyniki?')
          .setDescription('Typy użytkowników zostaną.')
          .setColor(0xffcc00),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('clear_only_results_yes')
            .setLabel('✅ Tak')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('clear_only_results_no')
            .setLabel('❌ Nie')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
  }

  // =========================
  // EXECUTION (GUILD SAFE)
  // =========================

  const del = (sql, label) =>
    safeQuery(pool, sql, [guildId], { guild_id: guildId, scope: 'clear', label });

  if (action === 'clear_db_yes') {
    try {
      await pool.query('START TRANSACTION');

      await del('DELETE FROM swiss_predictions WHERE guild_id = ?', 'delete swiss_predictions');
      await del('DELETE FROM playoffs_predictions WHERE guild_id = ?', 'delete playoffs_predictions');
      await del('DELETE FROM doubleelim_predictions WHERE guild_id = ?', 'delete doubleelim_predictions');
      await del('DELETE FROM playin_predictions WHERE guild_id = ?', 'delete playin_predictions');
      await del('DELETE FROM swiss_scores WHERE guild_id = ?', 'delete swiss_scores');
      await del('DELETE FROM playoffs_scores WHERE guild_id = ?', 'delete playoffs_scores');
      await del('DELETE FROM doubleelim_scores WHERE guild_id = ?', 'delete doubleelim_scores');
      await del('DELETE FROM playin_scores WHERE guild_id = ?', 'delete playin_scores');

      await pool.query('COMMIT');

      logger.info('clear', 'User picks cleared', userMeta);
      return safeFollowUp({ content: '🧹 Usunięto typy użytkowników.' });
    } catch (err) {
      await pool.query('ROLLBACK');
      logger.error('clear', 'Clear user picks failed', { ...userMeta, message: err.message });
      return safeFollowUp({ content: '❌ Błąd czyszczenia.' });
    }
  }

  if (action === 'clear_all_yes') {
    try {
      await pool.query('START TRANSACTION');

      await del('DELETE FROM active_panels WHERE guild_id = ?', 'delete active_panels');
      await del('DELETE FROM swiss_predictions WHERE guild_id = ?', 'delete swiss_predictions');
      await del('DELETE FROM playoffs_predictions WHERE guild_id = ?', 'delete playoffs_predictions');
      await del('DELETE FROM doubleelim_predictions WHERE guild_id = ?', 'delete doubleelim_predictions');
      await del('DELETE FROM playin_predictions WHERE guild_id = ?', 'delete playin_predictions');
      await del('DELETE FROM swiss_results WHERE guild_id = ?', 'delete swiss_results');
      await del('DELETE FROM playoffs_results WHERE guild_id = ?', 'delete playoffs_results');
      await del('DELETE FROM doubleelim_results WHERE guild_id = ?', 'delete doubleelim_results');
      await del('DELETE FROM playin_results WHERE guild_id = ?', 'delete playin_results');
      await del('DELETE FROM swiss_scores WHERE guild_id = ?', 'delete swiss_scores');
      await del('DELETE FROM playoffs_scores WHERE guild_id = ?', 'delete playoffs_scores');
      await del('DELETE FROM doubleelim_scores WHERE guild_id = ?', 'delete doubleelim_scores');
      await del('DELETE FROM playin_scores WHERE guild_id = ?', 'delete playin_scores');

      await pool.query('COMMIT');

      logger.warn('clear', 'FULL RESET completed', userMeta);
      return safeFollowUp({ content: '💣 Wykonano pełny reset.' });
    } catch (err) {
      await pool.query('ROLLBACK');
      logger.error('clear', 'FULL RESET failed', { ...userMeta, message: err.message });
      return safeFollowUp({ content: '❌ Błąd pełnego resetu.' });
    }
  }

  if (action === 'clear_only_results_yes') {
    try {
      await pool.query('START TRANSACTION');

      await del('DELETE FROM swiss_results WHERE guild_id = ?', 'delete swiss_results');
      await del('DELETE FROM playoffs_results WHERE guild_id = ?', 'delete playoffs_results');
      await del('DELETE FROM doubleelim_results WHERE guild_id = ?', 'delete doubleelim_results');
      await del('DELETE FROM playin_results WHERE guild_id = ?', 'delete playin_results');
      await del('DELETE FROM swiss_scores WHERE guild_id = ?', 'delete swiss_scores');
      await del('DELETE FROM playoffs_scores WHERE guild_id = ?', 'delete playoffs_scores');
      await del('DELETE FROM doubleelim_scores WHERE guild_id = ?', 'delete doubleelim_scores');
      await del('DELETE FROM playin_scores WHERE guild_id = ?', 'delete playin_scores');

      await pool.query('COMMIT');

      logger.info('clear', 'Official results cleared', userMeta);
      return safeFollowUp({ content: '🧹 Usunięto oficjalne wyniki.' });
    } catch (err) {
      await pool.query('ROLLBACK');
      logger.error('clear', 'Clear results failed', { ...userMeta, message: err.message });
      return safeFollowUp({ content: '❌ Błąd usuwania wyników.' });
    }
  }

  if (action.endsWith('_no')) {
    logger.info('clear', 'Clear action cancelled', userMeta);
    return safeFollowUp({ content: '✅ Anulowano.' });
  }

  logger.warn('clear', 'Unknown clear action', { ...userMeta, action });
  return safeFollowUp({ content: `❌ Nieznana akcja: ${action}` });
};
