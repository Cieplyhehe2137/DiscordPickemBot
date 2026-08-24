const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");
const { logError } = require("../../utils/logger");

const PAGE_SIZE = 23;

function safeLabel(str) {
  if (!str) return "mecz";
  const s = String(str);
  return s.length > 100 ? s.slice(0, 97) + "…" : s;
}

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return (
    perms?.has(PermissionFlagsBits.Administrator) ||
    perms?.has(PermissionFlagsBits.ManageGuild)
  );
}

function getScore(m) {
  return m.res_a === null || m.res_b === null ? "—" : `${m.res_a}:${m.res_b}`;
}

function buildPayload({ rows, phase, page }) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);

  const start = safePage * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  const options = pageRows.map((m) => {
    const label =
      `#${m.match_no ?? "?"} ${m.team_a} vs ${m.team_b} ` +
      `(BO${m.best_of}) [${getScore(m)}]`;

    return {
      label: safeLabel(label),
      value: String(m.id),
      description: "Wybierz, aby ustawić wynik",
    };
  });

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("match_admin_match_select")
      .setPlaceholder("Wybierz mecz do ustawienia wyniku…")
      .addOptions(options),
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`match_admin_page:${phase}:${safePage - 1}`)
      .setLabel("⬅️ Poprzednia")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 0),

    new ButtonBuilder()
      .setCustomId(`match_admin_page:${phase}:${safePage + 1}`)
      .setLabel("Następna ➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages - 1),
  );

  return {
    content:
      `🎯 **Wyniki meczów** — faza: **${phase}**\n` +
      `Strona **${safePage + 1}/${totalPages}** | Mecze: **${rows.length}**\n` +
      `Wybierz mecz:`,
    components: totalPages > 1 ? [selectRow, buttonRow] : [selectRow],
  };
}

module.exports = async function matchAdminPhaseSelect(interaction) {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "❌ Ta akcja działa tylko na serwerze.",
        ephemeral: true,
      });
    }

    if (!hasAdminPerms(interaction)) {
      return interaction.reply({
        content: "❌ Brak uprawnień.",
        ephemeral: true,
      });
    }

    let phase;
    let page = 0;

    if (interaction.isStringSelectMenu()) {
      phase = interaction.values?.[0];
    }

    if (interaction.isButton()) {
      const parts = interaction.customId.split(":");
      phase = parts[1];
      page = Number(parts[2] ?? 0);
    }

    if (!phase) {
      return interaction.update({
        content: "❌ Nie wybrano fazy.",
        components: [],
      });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const [rows] = await pool.query(
        `
        SELECT
          m.id,
          m.phase,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of,
          r.res_a,
          r.res_b
        FROM matches m
        LEFT JOIN match_results r
          ON r.match_id = m.id
         AND r.guild_id = m.guild_id
        WHERE m.guild_id = ?
          AND m.phase = ?
        ORDER BY COALESCE(m.match_no, 999999) ASC, m.id ASC
        `,
        [guildId, phase],
      );

      if (!rows.length) {
        return interaction.update({
          content:
            `ℹ️ Brak meczów w bazie dla fazy **${phase}**.\n` +
            `Dodaj je przyciskiem **➕ Dodaj mecz** w panelu.`,
          components: [],
        });
      }

      return interaction.update(buildPayload({ rows, phase, page }));
    });
  } catch (err) {
    logError("matches", "matchAdminPhaseSelect failed", {
      message: err.message,
      stack: err.stack,
    });

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: "❌ Błąd przy pobieraniu meczów z bazy.",
        ephemeral: true,
      });
    }

    return interaction.editReply({
      content: "❌ Błąd przy pobieraniu meczów z bazy.",
      components: [],
    });
  }
};
