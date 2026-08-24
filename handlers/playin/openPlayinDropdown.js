const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");

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
  cache.set(key, { ts: Date.now(), data });
}

module.exports = async (interaction) => {
  if (!interaction.guildId) {
    return interaction.reply({
      content: "❌ Ta akcja działa tylko na serwerze.",
      ephemeral: true,
    });
  }

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
      [guildId],
    );

    const teamNames = rows.map((r) => r.name).filter(Boolean);

    if (teamNames.length === 0) {
      return interaction.editReply({
        content: "❌ Brak aktywnych drużyn w bazie.",
      });
    }

    const userId = interaction.user.id;
    const key = `${guildId}:${userId}:playin`;
    const current = getCache(key) || [];

    const left = 8 - current.length;

    const embed = new EmbedBuilder()
      .setColor("#00b0f4")
      .setTitle("📌 Pick'Em – Play-In")
      .setDescription(
        `Wybrano **${current.length}/8** drużyn.\n\n` +
          (current.length
            ? `Obecne wybory:\n${current.join(", ")}`
            : "Nie wybrano jeszcze żadnej drużyny.") +
          "\n\nPo wyborze kliknij **Zatwierdź typy**.",
      );

    const availableTeams = teamNames.filter((t) => !current.includes(t));

    const dropdown = new StringSelectMenuBuilder()
      .setCustomId("playin_select")
      .setPlaceholder(
        left > 0 ? `Wybierz drużyny (${current.length}/8)` : "Uzupełniono 8/8",
      )
      .setMinValues(0)
      .setMaxValues(left > 0 ? Math.min(left, availableTeams.length) : 1)
      .setDisabled(left === 0)
      .addOptions(
        availableTeams.map((team) => ({
          label: team,
          value: team,
        })),
      );

    const rowSelect = new ActionRowBuilder().addComponents(dropdown);

    const rowButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_playin")
        .setLabel("✅ Zatwierdź typy")
        .setStyle(ButtonStyle.Success),
    );

    return interaction.editReply({
      embeds: [embed],
      components: [rowSelect, rowButtons],
    });
  });
};
