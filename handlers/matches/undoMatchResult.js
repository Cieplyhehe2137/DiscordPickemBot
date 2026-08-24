const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require("discord.js");

const isAdmin = require("../../utils/isAdmin");
const { withGuild } = require("../../utils/guildContext");
const { logError } = require("../../utils/logger");

module.exports = async function undoMatchResult(interaction) {
  try {
    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: "❌ Brak uprawnień.",
        ephemeral: true,
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({
        ephemeral: true,
      });
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      const [matches] = await pool.query(
        `
          SELECT
            m.id,
            m.event_id,
            m.phase,
            m.match_no,
            m.team_a,
            m.team_b,
            m.best_of,

            mr.res_a,
            mr.res_b,
            mr.finished_at

          FROM matches m

          INNER JOIN match_results mr
            ON mr.guild_id = m.guild_id
           AND mr.event_id = m.event_id
           AND mr.match_id = m.id

          WHERE m.guild_id = ?

          ORDER BY
            mr.finished_at DESC,
            m.id DESC

          LIMIT 25
          `,
        [guildId],
      );

      if (!matches.length) {
        return interaction.editReply({
          content: "ℹ️ Nie ma żadnych rozliczonych meczów do cofnięcia.",
          embeds: [],
          components: [],
        });
      }

      const options = matches.map((match) => {
        const number = match.match_no ? `#${match.match_no}` : `ID ${match.id}`;

        return {
          label:
            `${match.team_a} ${match.res_a}:${match.res_b} ${match.team_b}`.slice(
              0,
              100,
            ),

          description: `${number} • ${match.phase} • BO${match.best_of}`.slice(
            0,
            100,
          ),

          value: String(match.id),

          emoji: "↩️",
        };
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId("undo_match_result_select")
        .setPlaceholder("Wybierz mecz, którego wynik chcesz cofnąć")
        .addOptions(options);

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("↩️ Cofnięcie wyniku meczu")
        .setDescription(
          "Wybierz rozliczony mecz.\n\n" +
            "Operacja usunie **wynik meczu, wyniki map i naliczone punkty**.\n" +
            "Typy użytkowników pozostaną bez zmian.",
        );

      return interaction.editReply({
        content: "",
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(select)],
      });
    });
  } catch (err) {
    logError("matches", "undoMatchResult failed", {
      message: err.message,
      stack: err.stack,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction
        .editReply({
          content: "❌ Nie udało się pobrać rozliczonych meczów.",
          embeds: [],
          components: [],
        })
        .catch(() => {});
    }

    return interaction
      .reply({
        content: "❌ Nie udało się pobrać rozliczonych meczów.",
        ephemeral: true,
      })
      .catch(() => {});
  }
};
