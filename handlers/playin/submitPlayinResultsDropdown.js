// handlers/submitPlayinResultsDropdown.js

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const { logInfo, logWarn, logError } = require("../../utils/logger");
const { withGuild } = require("../../utils/guildContext");
const {
  getDraft,
  setDraft,
  clearDraft,
} = require("../../utils/predictionDraftCache");
const { loadActiveTeams } = require("../../utils/loadActiveTeams");
const { getOpenEventId } = require("../../utils/getOpenEventId");
const { getPhaseLimits } = require("../../utils/eventPickemConfig");
const { druzyny } = require("../../utils/odmiana");
const { runInTransaction } = require("../../utils/runInTransaction");

const uniq = (arr) => Array.from(new Set(arr));
const toString = (arr) => (arr && arr.length ? arr.join(", ") : "");

const NAMESPACE = "playin-results";

function getCache(key) {
  return getDraft(NAMESPACE, key);
}

function setCache(key, data) {
  setDraft(NAMESPACE, key, data);
}

module.exports = async (interaction) => {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "❌ Ta akcja działa tylko na serwerze.",
        ephemeral: true,
      });
    }

    const adminId = interaction.user.id;
    const guildId = interaction.guildId;
    const cacheKey = `${guildId}:${adminId}`;

    if (!getCache(cacheKey)) {
      setCache(cacheKey, { teams: [] });
    }

    const data = getCache(cacheKey);

    /* ===============================
       SELECT – inkrementacja
    =============================== */
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "official_playin_teams"
    ) {
      const incoming = interaction.values.map(String);
      const merged = uniq([...data.teams, ...incoming]);

      await withGuild(interaction, async ({ pool }) => {
        // Ile drużyn awansuje - z konfiguracji eventu, nie na sztywno.
        const eventId = await getOpenEventId(pool, guildId);

        if (!eventId) {
          return interaction.reply({
            content: "❌ Nie znaleziono aktywnego eventu.",
            ephemeral: true,
          });
        }

        const limity = await getPhaseLimits(pool, guildId, eventId, "playin");

        if (merged.length > limity.teams) {
          return interaction.reply({
            content:
              `❌ Play-In może mieć maksymalnie ${limity.teams} ` +
              `${druzyny(limity.teams)}.`,
            ephemeral: true,
          });
        }

        setCache(cacheKey, { teams: merged });

        const allTeams = await loadActiveTeams(pool, guildId);

        const left = limity.teams - merged.length;

        const available = allTeams.filter((t) => !merged.includes(t));

        const embed = new EmbedBuilder()
          .setColor("#00b0f4")
          .setTitle("📌 Oficjalne wyniki – Play-In")
          .setDescription(
            `Wybrano **${merged.length}/${limity.teams}** drużyn.\n\n` +
              (merged.length
                ? `Obecne wybory:\n${merged.join(", ")}`
                : "Nie wybrano jeszcze żadnej drużyny.") +
              "\n\nWybieraj inkrementalnie i kliknij **Zatwierdź**.",
          );

        const select = new StringSelectMenuBuilder()
          .setCustomId("official_playin_teams")
          .setPlaceholder(
            left > 0
              ? `Wybierz drużyny (${merged.length}/${limity.teams})`
              : `Uzupełniono ${limity.teams}/${limity.teams}`,
          )
          .setMinValues(0)
          .setMaxValues(left > 0 ? Math.min(left, available.length) : 1)
          .setDisabled(left === 0)
          .addOptions(
            available.map((team) => ({
              label: team,
              value: team,
            })),
          );

        const rowSelect = new ActionRowBuilder().addComponents(select);

        const rowButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("confirm_playin_results")
            .setLabel("✅ Zatwierdź")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("clear_playin_results")
            .setLabel("🗑 Wyczyść")
            .setStyle(ButtonStyle.Danger),
        );

        await interaction.update({
          embeds: [embed],
          components: [rowSelect, rowButtons],
        });
      });

      return;
    }

    /* ===============================
       CLEAR
    =============================== */
    if (
      interaction.isButton() &&
      interaction.customId === "clear_playin_results"
    ) {
      clearDraft(NAMESPACE, cacheKey);

      return interaction.reply({
        content: "🗑 Wybory zostały wyczyszczone.",
        ephemeral: true,
      });
    }

    /* ===============================
       CONFIRM
    =============================== */
    if (
      interaction.isButton() &&
      interaction.customId === "confirm_playin_results"
    ) {
      await interaction.deferReply({ ephemeral: true });

      if (!data.teams) {
        return interaction.editReply("❌ Najpierw wybierz drużyny.");
      }

      await withGuild(interaction, async ({ pool }) => {
        const allowed = new Set(await loadActiveTeams(pool, guildId));
        const invalid = data.teams.filter((t) => !allowed.has(t));

        if (invalid.length) {
          return interaction.editReply(
            `❌ Nieznane lub nieaktywne drużyny: ${invalid.join(", ")}`,
          );
        }

        const eventId = await getOpenEventId(pool, guildId);

        if (!eventId) {
          return interaction.editReply("❌ Nie znaleziono aktywnego eventu.");
        }

        // Komplet sprawdzamy dopiero tutaj, bo liczba drużyn należy do
        // eventu - wcześniej nie wiadomo, którego eventu dotyczy formularz.
        const limity = await getPhaseLimits(pool, guildId, eventId, "playin");

        if (data.teams.length !== limity.teams) {
          return interaction.editReply(
            `❌ Wybrano ${data.teams.length}/${limity.teams} ` +
              `${druzyny(limity.teams)}.`,
          );
        }

        try {
          await runInTransaction(pool, async (conn) => {
            await conn.query(
              `UPDATE playin_results
SET active = 0
WHERE guild_id = ?
  AND event_id = ?`,
              [guildId, eventId],
            );

            await conn.query(
              `
  INSERT INTO playin_results
    (guild_id, event_id, correct_teams, active)
  VALUES (?, ?, ?, 1)
  `,
              [guildId, eventId, toString(data.teams)],
            );
          });

          clearDraft(NAMESPACE, cacheKey);

          logInfo("playin", "Play-In results saved", {
            guildId,
            adminId,
            teams: data.teams,
          });

          return interaction.editReply(
            "✅ Oficjalne wyniki Play-In zostały zapisane.",
          );
        } catch (err) {
          logError("playin", "Error saving Play-In results", {
            guildId,
            adminId,
            message: err.message,
          });

          return interaction.editReply("❌ Błąd zapisu wyników Play-In.");
        }
      });
    }
  } catch (err) {
    logError("playin", "submitPlayinResultsDropdown crash", {
      message: err.message,
      stack: err.stack,
    });

    if (interaction.isRepliable()) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: "❌ Wystąpił błąd przy zapisie wyników Play-In.",
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  }
};
