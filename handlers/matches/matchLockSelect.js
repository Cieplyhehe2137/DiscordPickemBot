const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");

const {
  isMatchLocked,
  isMatchStarted,
  formatStartLocal,
} = require("../../utils/matchLock");

const { logError } = require("../../utils/logger");

function isAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

function getMode(match) {
  if (match.lock_override === null) {
    return "⚙️ AUTO";
  }

  if (Number(match.lock_override) === 1) {
    return "🔒 WYMUSZONY LOCK";
  }

  return "🔓 WYMUSZONY UNLOCK";
}

module.exports = async function matchLockSelect(interaction) {
  try {
    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: "⛔ Brak uprawnień.",
        ephemeral: true,
      });
    }

    const matchId = Number(interaction.values?.[0]);

    if (!matchId) {
      return interaction.reply({
        content: "❌ Nieprawidłowy mecz.",
        ephemeral: true,
      });
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      const [[match]] = await pool.query(
        `
          SELECT *
          FROM matches
          WHERE guild_id = ?
            AND id = ?
          LIMIT 1
          `,
        [guildId, matchId],
      );

      if (!match) {
        return interaction.update({
          content: "❌ Nie znaleziono meczu.",
          embeds: [],
          components: [],
        });
      }

      const locked = isMatchLocked(match);

      const started = isMatchStarted(match);

      const start = formatStartLocal(match.start_time_utc) || "brak";

      const embed = new EmbedBuilder()
        .setColor(locked ? 0xed4245 : 0x57f287)
        .setTitle(`🔐 ${match.team_a} vs ${match.team_b}`)
        .addFields(
          {
            name: "🎮 Mecz",
            value: `#${match.match_no || match.id}\n` + `BO${match.best_of}`,
            inline: true,
          },
          {
            name: "🕐 Start",
            value: start,
            inline: true,
          },
          {
            name: "⚙️ Tryb",
            value: getMode(match),
            inline: true,
          },
          {
            name: "🔐 Aktualny stan",
            value: locked ? "🔒 ZABLOKOWANY" : "🔓 OTWARTY",
            inline: true,
          },
          {
            name: "🏁 Start meczu",
            value: started ? "✅ Tak" : "❌ Nie",
            inline: true,
          },
        )
        .setDescription("Wybierz sposób działania blokady.");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`match_lock_set:${match.id}:auto`)
          .setLabel("AUTO")
          .setEmoji("⚙️")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`match_lock_set:${match.id}:lock`)
          .setLabel("Zablokuj")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(`match_lock_set:${match.id}:unlock`)
          .setLabel("Odblokuj")
          .setEmoji("🔓")
          .setStyle(ButtonStyle.Success),
      );

      return interaction.update({
        content: "",
        embeds: [embed],
        components: [row],
      });
    });
  } catch (err) {
    logError("matches", "matchLockSelect failed", {
      message: err.message,
      stack: err.stack,
    });
  }
};
