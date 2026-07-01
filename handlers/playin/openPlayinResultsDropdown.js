const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { withGuild } = require('../../utils/guildContext');
const { logInfo, logWarn, logError } = require('../../utils/logger');

module.exports = async (interaction) => {
  if (!interaction.guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

  const userId = interaction.user.id;

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
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

      const teams = rows.map(r => r.name).filter(Boolean);

      if (teams.length === 0) {
        return interaction.editReply({
          content: '❌ Brak aktywnych drużyn w bazie. Dodaj je w panelu admina.'
        });
      }

      if (teams.length > 25) {
        return interaction.editReply({
          content:
            `⚠️ Jest **${teams.length}** drużyn, a Discord pozwala max **25 opcji** w dropdownie.\n` +
            `➡️ Trzeba dodać stronicowanie (jak w match_add).`
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('📌 Oficjalne wyniki – Play-In')
        .setDescription(
          'Wybierz **8 drużyn**, które awansowały z fazy **Play-In**.\n\n' +
          'Po wyborze kliknij **Zatwierdź wyniki**.'
        )
        .setColor('#32CD32');

      const select = new StringSelectMenuBuilder()
        .setCustomId('official_playin_teams')
        .setPlaceholder('Wybierz 8 drużyn awansujących')
        .setMinValues(8)
        .setMaxValues(8)
        .addOptions(
          teams.map(team => ({
            label: team,
            value: team
          }))
        );

      const rowSelect = new ActionRowBuilder().addComponents(select);

      const rowConfirm = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_playin_results')
          .setLabel('✅ Zatwierdź wyniki')
          .setStyle(ButtonStyle.Success)
      );

      return interaction.editReply({
        embeds: [embed],
        components: [rowSelect, rowConfirm]
      });
    });

  } catch (err) {
    logError('playin', 'open official play-in results failed', {
      guildId: interaction.guildId,
      userId,
      message: err.message,
      stack: err.stack
    });

    return interaction.editReply({
      content: '❌ Wystąpił błąd podczas otwierania panelu Play-In.'
    }).catch(() => {});
  }
};
