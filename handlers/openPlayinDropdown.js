const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');


const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map();

function getCache(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return e.data;
}

function setCache(key, data) {
  cache.set(key, { ts: Date.now(), data })
}

module.exports = async (interaction) => {
  if (!interaction.guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

  // zawsze ephemeral
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  await withGuild(interaction, async ({ pool, guildId }) => {
    // 🔒 GUILD-SAFE QUERY
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

    const teamNames = rows.map(r => r.name).filter(Boolean);

    if (teamNames.length === 0) {
      return interaction.editReply({
        content: '❌ Brak aktywnych drużyn w bazie. Dodaj je w panelu admina.'
      });
    }

    if (teamNames.length > 25) {
      return interaction.editReply({
        content:
          `⚠️ Masz **${teamNames.length}** drużyn.\n` +
          `Discord pozwala max **25 opcji** w jednym dropdownie.\n` +
          `➡️ Trzeba tu dodać stronicowanie (tak jak w match_add).`
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#00b0f4')
      .setTitle('📌 Pick\'Em – Play-In')
      .setDescription(
        'Wybierz **8 drużyn**, które Twoim zdaniem **awansują z fazy Play-In**.'
      );

    // ⚠️ customId bez parametrów – router tego wymaga
    const dropdown = new StringSelectMenuBuilder()
      .setCustomId('playin_select')
      .setPlaceholder('Wybierz 8 drużyn')
      .setMinValues(8)
      .setMaxValues(8)
      .addOptions(
        teamNames.map(team => ({
          label: team,
          value: team
        }))
      );

    const rowSelect = new ActionRowBuilder().addComponents(dropdown);

    const rowConfirm = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_playin')
        .setLabel('✅ Zatwierdź typy')
        .setStyle(ButtonStyle.Success)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [rowSelect, rowConfirm]
    });
  });
};
