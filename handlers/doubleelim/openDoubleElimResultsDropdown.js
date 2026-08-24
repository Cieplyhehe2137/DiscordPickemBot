const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

const { withGuild } = require("../../utils/guildContext");

const {
  safeReply,
  safeDeferReply,
  safeEditReply,
} = require("../../utils/discord/safeReply");

const {
  loadDoubleElimTeams,
} = require("../../services/results/doubleElimResultService");

function makeOptions(teams) {
  return teams.slice(0, 25).map((t) => ({
    label: t.name,
    value: t.name,
  }));
}

module.exports = async function openDoubleElimResultsDropdown(interaction) {
  try {
    const guildId = interaction.guildId;

    if (!guildId) {
      return safeReply(interaction, {
        content: "❌ Ta akcja działa tylko na serwerze.",
        ephemeral: true,
      });
    }

    await safeDeferReply(interaction, {
      ephemeral: true,
    });

    return withGuild(guildId, async ({ pool }) => {
      const teams = await loadDoubleElimTeams(pool, guildId);

      if (!teams.length) {
        return safeEditReply(interaction, {
          content: "❌ Brak aktywnych drużyn w bazie.",
          components: [],
        });
      }

      if (teams.length > 25) {
        return safeEditReply(interaction, {
          content:
            `❌ Masz ${teams.length} aktywnych drużyn, a Discord select obsługuje max 25 opcji.\n` +
            `Trzeba dodać paginację albo ograniczyć aktywne drużyny.`,
          components: [],
        });
      }

      const options = makeOptions(teams);

      const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("double_results_upper_final_a")
          .setPlaceholder("Upper Final A — wybierz 2 drużyny")
          .setMinValues(2)
          .setMaxValues(2)
          .addOptions(options),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("double_results_lower_final_a")
          .setPlaceholder("Lower Final A — wybierz 2 drużyny")
          .setMinValues(2)
          .setMaxValues(2)
          .addOptions(options),
      );

      const row3 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("double_results_upper_final_b")
          .setPlaceholder("Upper Final B — wybierz 2 drużyny")
          .setMinValues(2)
          .setMaxValues(2)
          .addOptions(options),
      );

      const row4 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("double_results_lower_final_b")
          .setPlaceholder("Lower Final B — wybierz 2 drużyny")
          .setMinValues(2)
          .setMaxValues(2)
          .addOptions(options),
      );

      return safeEditReply(interaction, {
        content:
          "🧾 Wprowadź oficjalne wyniki Double Elimination.\n\n" +
          "Uzupełnij wszystkie 4 pola.",
        components: [row1, row2, row3, row4],
      });
    });
  } catch (err) {
    console.error("[openDoubleElimResultsDropdown]", err);

    return safeEditReply(interaction, {
      content: "❌ Błąd przy otwieraniu wyników Double Elim.",
      components: [],
    }).catch(() => {});
  }
};
