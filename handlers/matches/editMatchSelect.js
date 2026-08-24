const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require("discord.js");

const isAdmin = require("../../utils/isAdmin");
const { withGuild } = require("../../utils/guildContext");
const { logError } = require("../../utils/logger");

function formatDateForInput(value) {
  if (!value) {
    return "";
  }

  const utcDate = new Date(String(value).replace(" ", "T") + "Z");

  if (Number.isNaN(utcDate.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",

    year: "numeric",
    month: "2-digit",
    day: "2-digit",

    hour: "2-digit",
    minute: "2-digit",

    hourCycle: "h23",
  });

  return formatter.format(utcDate).replace(",", "");
}

module.exports = async function editMatchSelect(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) {
      return;
    }

    if (interaction.customId !== "edit_match_select") {
      return;
    }

    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: "❌ Brak uprawnień.",
        ephemeral: true,
      });
    }

    const matchId = Number(interaction.values?.[0]);

    if (!matchId) {
      return interaction.reply({
        content: "❌ Nieprawidłowe ID meczu.",
        ephemeral: true,
      });
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      const [[match]] = await pool.query(
        `
            SELECT
              m.id,
              m.event_id,
              m.match_no,
              m.team_a,
              m.team_b,
              m.best_of,
              m.start_time_utc,

              CASE
                WHEN mr.match_id IS NOT NULL
                THEN 1
                ELSE 0
              END AS has_result

            FROM matches m

            LEFT JOIN match_results mr
              ON mr.guild_id = m.guild_id
             AND mr.event_id = m.event_id
             AND mr.match_id = m.id

            WHERE m.guild_id = ?
              AND m.id = ?

            LIMIT 1
            `,
        [guildId, matchId],
      );

      if (!match) {
        return interaction.reply({
          content: "❌ Nie znaleziono meczu.",
          ephemeral: true,
        });
      }

      const lockedFields = Number(match.has_result) === 1;

      const modal = new ModalBuilder()
        .setCustomId(`edit_match_modal:${match.id}`)
        .setTitle(lockedFields ? "Edytuj rozliczony mecz" : "Edytuj mecz");

      const teamA = new TextInputBuilder()
        .setCustomId("team_a")
        .setLabel("Drużyna A")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(String(match.team_a || ""));

      const teamB = new TextInputBuilder()
        .setCustomId("team_b")
        .setLabel("Drużyna B")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(String(match.team_b || ""));

      const bestOf = new TextInputBuilder()
        .setCustomId("best_of")
        .setLabel("BO (1 / 3 / 5)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(String(match.best_of || 3));

      const matchNo = new TextInputBuilder()
        .setCustomId("match_no")
        .setLabel("Numer meczu")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(match.match_no == null ? "" : String(match.match_no));

      const startTime = new TextInputBuilder()
        .setCustomId("start_time")
        .setLabel("Start UTC: YYYY-MM-DD HH:mm")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(formatDateForInput(match.start_time_utc));

      if (lockedFields) {
        teamA.setPlaceholder("Rozliczony mecz — zmiana zablokowana");

        teamB.setPlaceholder("Rozliczony mecz — zmiana zablokowana");

        bestOf.setPlaceholder("Rozliczony mecz — zmiana zablokowana");
      }

      modal.addComponents(
        new ActionRowBuilder().addComponents(teamA),

        new ActionRowBuilder().addComponents(teamB),

        new ActionRowBuilder().addComponents(bestOf),

        new ActionRowBuilder().addComponents(matchNo),

        new ActionRowBuilder().addComponents(startTime),
      );

      const phaseSelect = new StringSelectMenuBuilder()
        .setCustomId(`edit_match_phase:${match.id}`)
        .setPlaceholder("Wybierz fazę meczu")
        .addOptions(
          {
            label: "Play-In",
            value: "playin",
            default: match.phase === "playin",
          },
          {
            label: "Swiss Stage 1",
            value: "swiss_stage1",
            default: match.phase === "swiss_stage1",
          },
          {
            label: "Swiss Stage 2",
            value: "swiss_stage2",
            default: match.phase === "swiss_stage2",
          },
          {
            label: "Swiss Stage 3",
            value: "swiss_stage3",
            default: match.phase === "swiss_stage3",
          },
          {
            label: "Playoffs",
            value: "playoffs",
            default: match.phase === "playoffs",
          },
          {
            label: "Double Elim",
            value: "doubleelim",
            default: match.phase === "doubleelim",
          },
        );

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("✏️ Edycja meczu")
        .setDescription(
          `**${match.team_a} vs ${match.team_b}**\n\n` +
            `Aktualna faza: **${match.phase}**\n\n` +
            "Najpierw wybierz fazę meczu.",
        );

      return interaction.update({
        content: "",
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(phaseSelect)],
      });
    });
  } catch (err) {
    logError("matches", "editMatchSelect failed", {
      message: err.message,
      stack: err.stack,
    });

    if (!interaction.replied && !interaction.deferred) {
      return interaction
        .reply({
          content: "❌ Nie udało się otworzyć edycji meczu.",
          ephemeral: true,
        })
        .catch(() => {});
    }
  }
};
