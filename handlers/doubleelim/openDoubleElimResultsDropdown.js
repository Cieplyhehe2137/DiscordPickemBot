const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");

const {
  safeReply,
  safeDeferReply,
  safeEditReply,
} = require("../../utils/discord/safeReply");

const {
  loadDoubleElimTeams,
} = require("../../services/results/doubleElimResultService");

const { getOpenEventId } = require("../../utils/getOpenEventId");
const { getPhaseLimits } = require("../../utils/eventPickemConfig");
const { druzyny } = require("../../utils/odmiana");

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

      const eventId = await getOpenEventId(pool, guildId);

      if (!eventId) {
        return safeEditReply(interaction, {
          content: "❌ Nie znaleziono aktywnego eventu.",
          components: [],
        });
      }

      const limity = await getPhaseLimits(
        pool,
        guildId,
        eventId,
        "doubleelim",
      );

      // Sloty muszą mieć customId, które zna submitDoubleElimResultsDropdown.
      // Wcześniej "Upper Final B" wskazywał na lower_final_b, a czwarty slot
      // miał identyfikator nieznany routerowi - w efekcie wyniku Upper Final B
      // nie dało się w ogóle wprowadzić.
      const slot = (customId, etykieta, ile) =>
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(`${etykieta} — wybierz ${ile} ${druzyny(ile)}`)
            .setMinValues(ile)
            .setMaxValues(ile)
            .addOptions(options),
        );

      const row1 = slot(
        "official_doubleelim_upper_final_a",
        "Upper Final A",
        limity.upperFinalA,
      );

      const row2 = slot(
        "official_doubleelim_lower_final_a",
        "Lower Final A",
        limity.lowerFinalA,
      );

      const row3 = slot(
        "official_doubleelim_upper_final_b",
        "Upper Final B",
        limity.upperFinalB,
      );

      const row4 = slot(
        "official_doubleelim_lower_final_b",
        "Lower Final B",
        limity.lowerFinalB,
      );

      // Przycisk zatwierdzania był routowany, ale nigdy nie renderowany -
      // bez niego nie dało się zapisać wpisanych wyników.
      const rowConfirm = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_official_doubleelim")
          .setLabel("✅ Zatwierdź wyniki")
          .setStyle(ButtonStyle.Success),
      );

      return safeEditReply(interaction, {
        content:
          "🧾 Wprowadź oficjalne wyniki Double Elimination.\n\n" +
          "Uzupełnij wszystkie 4 pola.",
        components: [row1, row2, row3, row4, rowConfirm],
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
