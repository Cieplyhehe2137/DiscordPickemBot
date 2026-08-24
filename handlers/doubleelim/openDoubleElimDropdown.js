const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");

async function loadTeamsFromDB(pool, guildId) {
  const [rows] = await pool.query(
    `SELECT name
     FROM teams
     WHERE guild_id = ?
       AND active = 1
     ORDER BY name ASC`,
    [guildId],
  );

  return rows.map((r) => r.name);
}

module.exports = async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "open_doubleelim_modal") return;

  await withGuild(interaction.guildId, async ({ pool, guildId }) => {
    const teams = await loadTeamsFromDB(pool, guildId);

    if (!teams.length) {
      const err = {
        content: "⚠️ Brak drużyn w bazie. Najpierw dodaj drużyny w managerze.",
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(err);
      }
      return interaction.reply(err);
    }

    const options = teams.map((t) => ({
      label: t,
      value: t,
    }));

    const embed = new EmbedBuilder()
      .setColor("#ff6600")
      .setTitle("📌 Typowanie fazy Double Elimination")
      .setDescription(
        [
          "Wybierz po **2 drużyny** w każdej pozycji:",
          "• **Upper Final – Grupa A** (2)",
          "• **Lower Final – Grupa A** (2)",
          "• **Upper Final – Grupa B** (2)",
          "• **Lower Final – Grupa B** (2)",
          "",
          "⚠️ Drużyny **nie mogą się powtarzać** między slotami.",
          "Po wyborze kliknij **Zatwierdź typy**.",
        ].join("\n"),
      );

    const row1 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("doubleelim_upper_final_a")
        .setPlaceholder("Upper Final – Grupa A (wybierz 2)")
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(options),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("doubleelim_lower_final_a")
        .setPlaceholder("Lower Final – Grupa A (wybierz 2)")
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(options),
    );

    const row3 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("doubleelim_upper_final_b")
        .setPlaceholder("Upper Final – Grupa B (wybierz 2)")
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(options),
    );

    const row4 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("doubleelim_lower_final_b")
        .setPlaceholder("Lower Final – Grupa B (wybierz 2)")
        .setMinValues(2)
        .setMaxValues(2)
        .addOptions(options),
    );

    const row5 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_doubleelim")
        .setLabel("✅ Zatwierdź typy")
        .setStyle(ButtonStyle.Success),
    );

    const payload = {
      embeds: [embed],
      components: [row1, row2, row3, row4, row5],
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(payload);
    }

    return interaction.reply(payload);
  });
};
