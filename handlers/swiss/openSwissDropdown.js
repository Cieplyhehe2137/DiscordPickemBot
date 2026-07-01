const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const { withGuild } = require('../../utils/guildContext');
const { logInfo, logWarn, logError } = require('../../utils/logger');

async function loadTeamsWithFlags(pool, guildId) {
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

  return rows.map(r => ({
    name: r.name,
    label: `${r.flag || ''} ${r.name}`.trim()
  }));
}

module.exports = async (interaction) => {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    const match = interaction.customId.match(/^start_swiss_(.+)$/);
    const stage = match?.[1];
    if (!stage) {
      return interaction.reply({
        content: '❌ Brak stage w customId.',
        ephemeral: true
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const teams = await loadTeamsWithFlags(pool, guildId);

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

      const teamList = teams.map(t => t.label).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`📋 Typowanie – SWISS (${stage.toUpperCase()})`)
        .setDescription('Wybierz swoje typy i kliknij **Zatwierdź typy**.')
        .addFields({
          name: '📌 Dostępne drużyny:',
          value: teamList
        })
        .setColor('#0099ff');

      const options = teams.map(t => ({
        label: t.label,
        value: t.name
      }));

      const rows = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`swiss_3_0:${stage}`)
            .setPlaceholder('🔥 Wybierz 2 drużyny 3-0')
            .setMinValues(2)
            .setMaxValues(2)
            .addOptions(options)
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`swiss_0_3:${stage}`)
            .setPlaceholder('💀 Wybierz 2 drużyny 0-3')
            .setMinValues(2)
            .setMaxValues(2)
            .addOptions(options)
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`swiss_advancing:${stage}`)
            .setPlaceholder('🚀 Wybierz 6 drużyn 3-1 / 3-2')
            .setMinValues(6)
            .setMaxValues(6)
            .addOptions(options)
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_swiss:${stage}`)
            .setLabel('✅ Zatwierdź typy')
            .setStyle(ButtonStyle.Success)
        )
      ];

      return interaction.editReply({
        embeds: [embed],
        components: rows
      });
    });

  } catch (err) {
    logError('swiss', 'openSwissDropdown failed', {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.editReply({
      content: '❌ Wystąpił błąd podczas generowania Swiss.'
    }).catch(() => {});
  }
};
