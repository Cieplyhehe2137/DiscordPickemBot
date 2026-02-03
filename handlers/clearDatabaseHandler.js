const isAdmin = require('../utils/isAdmin');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');

module.exports = async (interaction) => {
  if (!interaction.guildId) return;

  const guildId = interaction.guildId;

  // 🔒 ADMIN ONLY
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: '❌ Brak uprawnień do tej operacji.',
      ephemeral: true,
    }).catch(() => {});
  }

  const userMeta = {
    guildId,
    userId: interaction.user.id,
    username: interaction.user.tag,
    customId: interaction.customId,
  };

  logger.warn('clear', 'Clear interaction triggered', userMeta);

  const aliasMap = {
    clear_user_picks: 'clear_db_confirm',
    full_reset: 'clear_db_with_results',
    clear_official_results: 'clear_only_results_confirm',
  };

  const action = aliasMap[interaction.customId] || interaction.customId;

  // 🔑 UNIWERSALNE ODPowiedzi (select + button)
  const respond = async (payload) => {
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply(payload).catch(() => {});
    }
    return interaction.reply({ ephemeral: true, ...payload }).catch(() => {});
  };

  /* =========================
     CONFIRM PANELS
     ========================= */

  if (action === 'clear_db_confirm') {
    return respond({
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
    return respond({
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
    return respond({
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

  /* =========================
     EXECUTION
     ========================= */

  try {
    await withGuild(interaction.guildId, async ({ pool }) => {
      const del = async (sql) => pool.query(sql, [guildId]);

      if (action === 'clear_db_yes') {
        await pool.query('START TRANSACTION');
        await del('DELETE FROM swiss_predictions WHERE guild_id = ?');
        await del('DELETE FROM playoffs_predictions WHERE guild_id = ?');
        await del('DELETE FROM doubleelim_predictions WHERE guild_id = ?');
        await del('DELETE FROM playin_predictions WHERE guild_id = ?');
        await pool.query('COMMIT');
        return respond({ content: '🧹 Usunięto typy użytkowników.' });
      }

      if (action === 'clear_all_yes') {
        await pool.query('START TRANSACTION');
        await del('DELETE FROM active_panels WHERE guild_id = ?');
        await del('DELETE FROM swiss_predictions WHERE guild_id = ?');
        await del('DELETE FROM playoffs_predictions WHERE guild_id = ?');
        await del('DELETE FROM doubleelim_predictions WHERE guild_id = ?');
        await del('DELETE FROM playin_predictions WHERE guild_id = ?');
        await pool.query('COMMIT');
        return respond({ content: '💣 Wykonano pełny reset.' });
      }

      if (action === 'clear_only_results_yes') {
        await pool.query('START TRANSACTION');
        await del('DELETE FROM swiss_results WHERE guild_id = ?');
        await del('DELETE FROM playoffs_results WHERE guild_id = ?');
        await del('DELETE FROM doubleelim_results WHERE guild_id = ?');
        await del('DELETE FROM playin_results WHERE guild_id = ?');
        await pool.query('COMMIT');
        return respond({ content: '🧹 Usunięto oficjalne wyniki.' });
      }

      if (action.endsWith('_no')) {
        return respond({ content: '✅ Anulowano.' });
      }

      return respond({ content: `❌ Nieznana akcja: ${action}` });
    });
  } catch (err) {
    logger.error('clear', 'Clear operation failed', {
      ...userMeta,
      message: err.message,
      stack: err.stack,
    });
    return respond({ content: '❌ Wystąpił błąd podczas czyszczenia.' });
  }
};
