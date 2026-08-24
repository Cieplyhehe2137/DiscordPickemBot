const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { logInfo, logWarn, logError } = require("../../utils/logger");
const { withGuild } = require("../../utils/guildContext");
const { isMatchLocked } = require("../../utils/matchLock");

const PAGE_SIZE = 23; // 23 meczów + PREV + NEXT = max 25

function safeLabel(s) {
  const str = String(s ?? "");
  if (!str) return "mecz";
  return str.length > 100 ? str.slice(0, 97) + "…" : str;
}

function safeValue(s) {
  const str = String(s ?? "");
  return str.length > 100 ? str.slice(0, 100) : str;
}

async function respond(interaction, payload, isUpdate) {
  try {
    if (isUpdate) return await interaction.update(payload);

    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    }

    return await interaction.reply(payload);
  } catch (_) {
    try {
      return await interaction.followUp({ ...payload, ephemeral: true });
    } catch (_) {}
  }
}

async function sendMatchList({
  interaction,
  phaseKey,
  mode,
  page = 0,
  isUpdate,
}) {
  const safePage = Math.max(0, Number(page) || 0);
  const offset = safePage * PAGE_SIZE;

  return withGuild(interaction, async ({ pool, guildId }) => {
    const userId = interaction.user.id;

    const [rows] = await pool.query(
      `
  SELECT
    m.id,
    m.match_no,
    m.team_a,
    m.team_b,
    m.best_of,
    m.is_locked,
    m.start_time_utc,

    mp.pred_a,
    mp.pred_b,
    mp.pred_exact_a,
    mp.pred_exact_b,

    COALESCE(mmp.saved_maps, 0) AS saved_maps,

    CASE
      WHEN m.best_of = 1
        AND mp.match_id IS NOT NULL
        AND mp.pred_exact_a IS NOT NULL
        AND mp.pred_exact_b IS NOT NULL
      THEN 'complete'

      WHEN m.best_of > 1
        AND mp.match_id IS NOT NULL
        AND COALESCE(mmp.saved_maps, 0) >= (mp.pred_a + mp.pred_b)
      THEN 'complete'

      WHEN mp.match_id IS NOT NULL
        OR COALESCE(mmp.saved_maps, 0) > 0
      THEN 'partial'

      ELSE 'empty'
    END AS prediction_status

  FROM matches m

  LEFT JOIN match_predictions mp
    ON mp.guild_id = m.guild_id
    AND mp.match_id = m.id
    AND mp.user_id = ?

  LEFT JOIN (
    SELECT
      guild_id,
      match_id,
      user_id,
      COUNT(*) AS saved_maps
    FROM match_map_predictions
    GROUP BY guild_id, match_id, user_id
  ) mmp
    ON mmp.guild_id = m.guild_id
    AND mmp.match_id = m.id
    AND mmp.user_id = ?

  WHERE m.guild_id = ?
    AND m.phase = ?

  ORDER BY COALESCE(m.match_no, 999999), m.id
  LIMIT ? OFFSET ?
  `,
      [userId, userId, guildId, phaseKey, PAGE_SIZE + 1, offset],
    );

    const [[progress]] = await pool.query(
      `
  SELECT
    COUNT(*) AS total_matches,

    SUM(
      CASE
        WHEN x.prediction_status = 'complete'
        THEN 1
        ELSE 0
      END
    ) AS complete_matches

  FROM (
    SELECT
      m.id,

      CASE
        WHEN m.best_of = 1
          AND mp.match_id IS NOT NULL
          AND mp.pred_exact_a IS NOT NULL
          AND mp.pred_exact_b IS NOT NULL
        THEN 'complete'

        WHEN m.best_of > 1
          AND mp.match_id IS NOT NULL
          AND COALESCE(mmp.saved_maps, 0) >= (mp.pred_a + mp.pred_b)
        THEN 'complete'

        WHEN mp.match_id IS NOT NULL
          OR COALESCE(mmp.saved_maps, 0) > 0
        THEN 'partial'

        ELSE 'empty'
      END AS prediction_status

    FROM matches m

    LEFT JOIN match_predictions mp
      ON mp.guild_id = m.guild_id
      AND mp.match_id = m.id
      AND mp.user_id = ?

    LEFT JOIN (
      SELECT
        guild_id,
        match_id,
        user_id,
        COUNT(*) AS saved_maps
      FROM match_map_predictions
      GROUP BY guild_id, match_id, user_id
    ) mmp
      ON mmp.guild_id = m.guild_id
      AND mmp.match_id = m.id
      AND mmp.user_id = ?

    WHERE m.guild_id = ?
      AND m.phase = ?
  ) x
  `,
      [userId, userId, guildId, phaseKey],
    );

    const totalMatches = Number(progress?.total_matches || 0);
    const predictedMatches = Number(progress?.complete_matches || 0);

    if (!rows.length) {
      return respond(
        interaction,
        {
          content: `Brak meczów dla fazy **${phaseKey}**.`,
          components: [],
        },
        isUpdate,
      );
    }

    const hasPrev = safePage > 0;
    const hasNext = rows.length > PAGE_SIZE;
    const slice = rows.slice(0, PAGE_SIZE);

    const customId =
      mode === "res" ? "match_pick_select_res" : "match_pick_select_pred";

    const options = slice.map((m) => {
      const locked = isMatchLocked(m);
      let statusEmoji = "🎮";

      if (mode === "res") {
        statusEmoji = "🧾";
      } else if (m.prediction_status === "complete") {
        statusEmoji = "✅";
      } else if (m.prediction_status === "partial") {
        statusEmoji = "🟡";
      }

      const label =
        `${statusEmoji} ` +
        `${m.match_no ? `#${m.match_no} ` : ""}` +
        `${m.team_a} vs ${m.team_b} (Bo${m.best_of})` +
        `${locked ? " 🔒" : ""}`;

      return {
        label: safeLabel(label),
        value: safeValue(`MATCH|${phaseKey}|${m.id}`),
      };
    });

    if (hasPrev) {
      options.push({
        label: safeLabel("⬅️ Poprzednia strona"),
        value: safeValue(`PREV|${phaseKey}|${safePage - 1}`),
      });
    }

    if (hasNext) {
      options.push({
        label: safeLabel("➡️ Następna strona"),
        value: safeValue(`NEXT|${phaseKey}|${safePage + 1}`),
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(`Wybierz mecz... (strona ${safePage + 1})`)
        .addOptions(options),
    );

    return respond(
      interaction,
      {
        content:
          mode === "res"
            ? `🧾 Wybierz mecz, aby **wprowadzić oficjalny wynik** (faza: **${phaseKey}**)`
            : [
                `🎯 Wybierz mecz do **wytypowania wyniku**`,
                `📊 Postęp: **${predictedMatches}/${totalMatches}**`,
                "",
                `✅ Wytypowano`,
                `🎮 Do wytypowania`,
                `Faza: **${phaseKey}**`,
              ].join("\n"),
        components: [row],
      },
      isUpdate,
    );
  });
}

module.exports = async function openMatchPick(interaction) {
  try {
    const customId = interaction.customId || "";
    const phaseKey = customId.split(":")[1];

    if (!phaseKey) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }

      return interaction.editReply({
        content: "❌ Brak phaseKey w CustomId",
        components: [],
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    await sendMatchList({
      interaction,
      phaseKey,
      mode: "pred",
      page: 0,
      isUpdate: false,
    });
  } catch (err) {
    logError("matches", "openMatchPick failed", {
      message: err.message,
      stack: err.stack,
    });

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }

      await interaction.editReply({
        content: "❌ Błąd przy ładowaniu listy meczów.",
        components: [],
      });
    } catch (_) {}
  }
};

module.exports.sendMatchList = sendMatchList;
