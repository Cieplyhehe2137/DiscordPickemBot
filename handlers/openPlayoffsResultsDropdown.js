const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');

async function loadTeamsFromDB(pool, guildId) {
  const [rows] = await pool.query(
    `
    SELECT name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY sort_order ASC, name ASC
    `,
    [guildId]
  );
  return rows.map(r => r.name).filter(Boolean);
}

module.exports = async (interaction) => {
  if (interaction.customId !== 'open_results_playoffs') return;

  if (!interaction.guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const teams = await loadTeamsFromDB(pool, guildId);

      if (!teams.length) {
        return interaction.editReply({
          content: '❌ Brak aktywnych drużyn w bazie.'
        });
      }

      if (teams.length > 25) {
        return interaction.editReply({
          content:
            `⚠️ Jest **${teams.length} drużyn**, a Discord pozwala max **25 opcji** w dropdownie.\n` +
            `➡️ Dodaj stronicowanie (jak w meczach).`
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 Ustaw wyniki Playoffs')
        .setDescription(
          'Możesz **dodawać drużyny partiami** – dokładnie jak w Swiss.\n' +
          'Dropdowny zapisują stan w bazie.'
        )
        .setColor('#ffcc00');

      const makeOptions = () => teams.map(t => ({ label: t, value: t }));

      const rows = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('results_playoffs_semifinalists')
            .setPlaceholder('Półfinaliści (max 4)')
            .setMinValues(0)
            .setMaxValues(4)
            .addOptions(makeOptions())
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('results_playoffs_finalists')
            .setPlaceholder('Finaliści (max 2)')
            .setMinValues(0)
            .setMaxValues(2)
            .addOptions(makeOptions())
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('results_playoffs_winner')
            .setPlaceholder('Zwycięzca')
            .setMinValues(0)
            .setMaxValues(1)
            .addOptions(makeOptions())
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('results_playoffs_third_place_winner')
            .setPlaceholder('3. miejsce (opcjonalnie)')
            .setMinValues(0)
            .setMaxValues(1)
            .addOptions(makeOptions())
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_playoffs_results')
            .setLabel('✅ Zatwierdź')
            .setStyle(ButtonStyle.Success)
        )
      ];

      return interaction.editReply({
        embeds: [embed],
        components: rows
      });
    });

  } catch (err) {
    logger.error('playoffs', 'open_results_playoffs failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.editReply({
      content: '❌ Błąd podczas otwierania wyników Playoffs.'
    }).catch(() => {});
  }
};
