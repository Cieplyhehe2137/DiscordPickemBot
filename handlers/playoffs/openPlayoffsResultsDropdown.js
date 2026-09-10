const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");
const { logInfo, logWarn, logError } = require("../../utils/logger");
const { loadActiveTeamsBySortOrder } = require("../../utils/loadActiveTeams");
const { getOpenEventId } = require("../../utils/getOpenEventId");
const { getPhaseLimits } = require("../../utils/eventPickemConfig");

module.exports = async (interaction) => {
  if (interaction.customId !== "open_results_playoffs") return;

  if (!interaction.guildId) {
    return interaction.reply({
      content: "❌ Ta akcja działa tylko na serwerze.",
      ephemeral: true,
    });
  }

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const teams = await loadActiveTeamsBySortOrder(pool, guildId);

      if (!teams.length) {
        return interaction.editReply({
          content: "❌ Brak aktywnych drużyn w bazie.",
        });
      }

      if (teams.length > 25) {
        return interaction.editReply({
          content:
            `⚠️ Jest **${teams.length} drużyn**, a Discord pozwala max **25 opcji** w dropdownie.\n` +
            `➡️ Dodaj stronicowanie (jak w meczach).`,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🏆 Ustaw wyniki Playoffs")
        .setDescription(
          "Możesz **dodawać drużyny partiami** – dokładnie jak w Swiss.\n" +
            "Dropdowny zapisują stan w bazie.",
        )
        .setColor("#ffcc00");

      // Sufity kategorii bierzemy z konfiguracji eventu. Przy wynikach to
      // maksimum, nie liczba wymagana - admin wpisuje wynik etapami.
      const eventId = await getOpenEventId(pool, guildId);

      if (!eventId) {
        return interaction.editReply({
          content: "❌ Nie znaleziono aktywnego eventu.",
        });
      }

      const limity = await getPhaseLimits(pool, guildId, eventId, "playoffs");

      const makeOptions = () => teams.map((t) => ({ label: t, value: t }));

      const rows = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("results_playoffs_semifinalists")
            .setPlaceholder(`Półfinaliści (max ${limity.semifinalists})`)
            .setMinValues(0)
            .setMaxValues(limity.semifinalists)
            .addOptions(makeOptions()),
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("results_playoffs_finalists")
            .setPlaceholder(`Finaliści (max ${limity.finalists})`)
            .setMinValues(0)
            .setMaxValues(limity.finalists)
            .addOptions(makeOptions()),
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("results_playoffs_winner")
            .setPlaceholder("Zwycięzca")
            .setMinValues(0)
            .setMaxValues(limity.winner)
            .addOptions(makeOptions()),
        ),
        ...(limity.third > 0
          ? [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("results_playoffs_third_place_winner")
                .setPlaceholder("3. miejsce (opcjonalnie)")
                .setMinValues(0)
                .setMaxValues(limity.third)
                .addOptions(makeOptions()),
            ),
          ]
          : []),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("confirm_playoffs_results")
            .setLabel("✅ Zatwierdź")
            .setStyle(ButtonStyle.Success),
        ),
      ];

      return interaction.editReply({
        embeds: [embed],
        components: rows,
      });
    });
  } catch (err) {
    logError("playoffs", "open_results_playoffs failed", {
      guildId: interaction.guildId,
      message: err.message,
      stack: err.stack,
    });

    return interaction
      .editReply({
        content: "❌ Błąd podczas otwierania wyników Playoffs.",
      })
      .catch(() => {});
  }
};
