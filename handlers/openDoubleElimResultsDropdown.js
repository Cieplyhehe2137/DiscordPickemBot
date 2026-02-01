const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) ||
    perms?.has(PermissionFlagsBits.ManageGuild);
}

async function loadTeamsFromDB(pool, guildId) {
  const [rows] = await pool.query(
    `SELECT name
     FROM teams
     WHERE guild_id = ?
       AND active = 1
     ORDER BY name ASC`,
    [guildId]
  );
  return rows.map(r => r.name);
}

module.exports = async (interaction) => {
  try {
    if (!hasAdminPerms(interaction)) {
      const err = { content: '❌ Brak uprawnień (Administrator / Zarządzanie serwerem).' };
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(err);
      }
      return interaction.reply({ ...err, ephemeral: true });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    await withGuild(interaction.guildId, async ({ pool, guildId }) => {
      const teams = await loadTeamsFromDB(pool, guildId);

      if (!teams.length) {
        return interaction.editReply({
          content: '⚠️ Brak aktywnych drużyn w bazie.',
          components: []
        });
      }

      const options = teams.map(t => ({ label: t, value: t }));

      const embed = new EmbedBuilder()
        .setColor('#3399ff')
        .setTitle('🛠️ Oficjalne wyniki – Double Elimination')
        .setDescription([
          'Wybierz **zwycięzcę** dla każdej pozycji:',
          '• **Upper Final – Grupa A**',
          '• **Lower Final – Grupa A**',
          '• **Upper Final – Grupa B**',
          '• **Lower Final – Grupa B**',
          '',
          'Na końcu kliknij **Zatwierdź wyniki**.'
        ].join('\n'));

      const mkRow = (id, label) =>
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(id)
            .setPlaceholder(label)
            .setMinValues(2)
            .setMaxValues(2)
            .addOptions(options)
        );

      const confirm = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_official_doubleelim')
          .setLabel('✅ Zatwierdź wyniki')
          .setStyle(ButtonStyle.Success)
      );

      return interaction.editReply({
        embeds: [embed],
        components: [
          mkRow('official_doubleelim_upper_final_a', 'Upper Final – Grupa A'),
          mkRow('official_doubleelim_lower_final_a', 'Lower Final – Grupa A'),
          mkRow('official_doubleelim_upper_final_b', 'Upper Final – Grupa B'),
          mkRow('official_doubleelim_lower_final_b', 'Lower Final – Grupa B'),
          confirm
        ]
      });
    });
  } catch (err) {
    console.error('❌ Błąd w openDoubleElimResultsDropdown:', err);
    return interaction.editReply({
      content: '❌ Wystąpił błąd przy otwieraniu wyników Double Elim.',
      components: []
    }).catch(() => { });
  }
};
