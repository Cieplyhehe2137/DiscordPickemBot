const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");
const { getActiveEventId } = require("../../utils/getOpenEventId");
const { logError } = require("../../utils/logger");

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function getMatchLabel(match) {
  const number = match.match_no ?? match.id;

  return `#${number} ${match.team_a} vs ${match.team_b}`;
}

module.exports = async function eventAudit(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "⛔ Tylko administracja.",
      ephemeral: true,
    });
  }

  const isRefresh = interaction.customId === "panel:audit:refresh";

  try {
    if (isRefresh) {
      await interaction.deferUpdate();
    } else {
      await interaction.deferReply({
        ephemeral: true,
      });
    }

    return withGuild(interaction, async ({ guildId, pool }) => {
      const eventId = await getActiveEventId(pool, guildId);

      if (!eventId) {
        return interaction.editReply({
          content: "❌ Nie znaleziono aktywnego eventu.",
          embeds: [],
          components: [],
        });
      }

      const [[event]] = await pool.query(
        `
        SELECT
          id,
          name,
          phase,
          status
        FROM events
        WHERE guild_id = ?
          AND id = ?
        LIMIT 1
        `,
        [guildId, eventId],
      );

      if (!event) {
        return interaction.editReply({
          content: "❌ Nie znaleziono danych eventu.",
          embeds: [],
          components: [],
        });
      }

      // =====================================================
      // STAN SYSTEMU / PANELI
      // =====================================================

      const [[panelStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total,

          SUM(
            CASE
              WHEN active = 1
               AND COALESCE(closed, 0) = 0
              THEN 1
              ELSE 0
            END
          ) AS active_total,

          SUM(
            CASE
              WHEN phase = ?
               AND active = 1
               AND COALESCE(closed, 0) = 0
              THEN 1
              ELSE 0
            END
          ) AS current_phase_active

        FROM active_panels
        WHERE guild_id = ?
        `,
        [event.phase, guildId],
      );

      const [[activePhasePanel]] = await pool.query(
        `
        SELECT
          id,
          channel_id,
          message_id,
          deadline
        FROM active_panels
        WHERE guild_id = ?
          AND phase = ?
          AND active = 1
          AND COALESCE(closed, 0) = 0
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, event.phase],
      );

      const [[matchPanelStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total,

          SUM(
            CASE
              WHEN panel_channel_id IS NOT NULL
               AND panel_message_id IS NOT NULL
              THEN 1
              ELSE 0
            END
          ) AS with_panel

        FROM matches
        WHERE guild_id = ?
          AND event_id = ?
        `,
        [guildId, eventId],
      );

      const [overdueUnlockedMatches] = await pool.query(
        `
        SELECT
          id,
          match_no,
          team_a,
          team_b,
          best_of,
          start_time_utc
        FROM matches
        WHERE guild_id = ?
          AND event_id = ?
          AND start_time_utc IS NOT NULL
          AND start_time_utc <= UTC_TIMESTAMP()
          AND is_locked = 0
        ORDER BY start_time_utc ASC, match_no ASC, id ASC
        `,
        [guildId, eventId],
      );

      const [[pendingEditStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total,

          SUM(
            CASE
              WHEN created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
              THEN 1
              ELSE 0
            END
          ) AS stale

        FROM pending_match_edits
        WHERE guild_id = ?
        `,
        [guildId],
      );

      let phasePanelMessageOk = false;
      let phasePanelMessageChecked = false;

      if (activePhasePanel?.channel_id && activePhasePanel?.message_id) {
        phasePanelMessageChecked = true;

        try {
          const panelChannel = await interaction.client.channels.fetch(
            String(activePhasePanel.channel_id),
          );

          if (panelChannel?.messages?.fetch) {
            await panelChannel.messages.fetch(
              String(activePhasePanel.message_id),
            );

            phasePanelMessageOk = true;
          }
        } catch (_) {
          phasePanelMessageOk = false;
        }
      }

      // =====================================================
      // MECZE
      // =====================================================

      const [[matchStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total,

          SUM(
            CASE
              WHEN best_of NOT IN (1, 3, 5)
              THEN 1
              ELSE 0
            END
          ) AS invalid_best_of,

          SUM(
            CASE
              WHEN start_time_utc IS NULL
              THEN 1
              ELSE 0
            END
          ) AS without_start_time,

          SUM(
            CASE
              WHEN is_locked = 1
              THEN 1
              ELSE 0
            END
          ) AS locked

        FROM matches

        WHERE guild_id = ?
          AND event_id = ?
        `,
        [guildId, eventId],
      );

      // =====================================================
      // MECZE BEZ GODZINY
      // =====================================================

      const [matchesWithoutTime] = await pool.query(
        `
        SELECT
          id,
          match_no,
          team_a,
          team_b,
          best_of
        FROM matches
        WHERE guild_id = ?
          AND event_id = ?
          AND start_time_utc IS NULL
        ORDER BY match_no ASC, id ASC
        `,
        [guildId, eventId],
      );

      // =====================================================
      // NIEPOPRAWNE BO
      // =====================================================

      const [invalidBestOfMatches] = await pool.query(
        `
        SELECT
          id,
          match_no,
          team_a,
          team_b,
          best_of
        FROM matches
        WHERE guild_id = ?
          AND event_id = ?
          AND best_of NOT IN (1, 3, 5)
        ORDER BY match_no ASC, id ASC
        `,
        [guildId, eventId],
      );

      // =====================================================
      // WYNIKI MECZÓW
      // =====================================================

      const [[resultStats]] = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM match_results
        WHERE guild_id = ?
          AND event_id = ?
          AND res_a IS NOT NULL
          AND res_b IS NOT NULL
        `,
        [guildId, eventId],
      );

      const [results] = await pool.query(
        `
        SELECT
          m.id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of,
          r.res_a,
          r.res_b

        FROM matches m

        INNER JOIN match_results r
          ON r.match_id = m.id
         AND r.guild_id = m.guild_id
         AND r.event_id = m.event_id

        WHERE m.guild_id = ?
          AND m.event_id = ?
          AND r.res_a IS NOT NULL
          AND r.res_b IS NOT NULL

        ORDER BY m.match_no ASC, m.id ASC
        `,
        [guildId, eventId],
      );

      const invalidResults = [];

      for (const match of results) {
        const bestOf = Number(match.best_of);
        const a = Number(match.res_a);
        const b = Number(match.res_b);

        let valid = true;

        if (bestOf === 1) {
          valid = (a === 1 && b === 0) || (a === 0 && b === 1);
        }

        if (bestOf === 3) {
          valid =
            (a === 2 && b >= 0 && b <= 1) || (b === 2 && a >= 0 && a <= 1);
        }

        if (bestOf === 5) {
          valid =
            (a === 3 && b >= 0 && b <= 2) || (b === 3 && a >= 0 && a <= 2);
        }

        if (!valid) {
          invalidResults.push(match);
        }
      }

      // =====================================================
      // TYPY
      // =====================================================

      const [[predictionStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT user_id) AS users

        FROM match_predictions

        WHERE guild_id = ?
          AND event_id = ?
        `,
        [guildId, eventId],
      );

      // =====================================================
      // TYP SERII BO3/BO5 BEZ ŻADNYCH MAP
      // =====================================================

      const [missingMapPredictions] = await pool.query(
        `
        SELECT
          p.user_id,
          p.match_id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of

        FROM match_predictions p

        INNER JOIN matches m
          ON m.id = p.match_id
         AND m.guild_id = p.guild_id
         AND m.event_id = p.event_id

        LEFT JOIN match_map_predictions mp
          ON mp.match_id = p.match_id
         AND mp.guild_id = p.guild_id
         AND mp.event_id = p.event_id
         AND mp.user_id = p.user_id

        WHERE p.guild_id = ?
          AND p.event_id = ?
          AND m.best_of IN (3, 5)

        GROUP BY
          p.user_id,
          p.match_id,
          m.id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of

        HAVING COUNT(mp.id) = 0
        `,
        [guildId, eventId],
      );

      // =====================================================
      // BRAKUJĄCE WYNIKI MAP
      // =====================================================

      const [matchesWithResults] = await pool.query(
        `
        SELECT
          m.id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of,
          r.res_a,
          r.res_b,

          COUNT(mmr.id) AS map_results

        FROM matches m

        INNER JOIN match_results r
          ON r.match_id = m.id
         AND r.guild_id = m.guild_id
         AND r.event_id = m.event_id

        LEFT JOIN match_map_results mmr
          ON mmr.match_id = m.id
         AND mmr.guild_id = m.guild_id
         AND mmr.event_id = m.event_id

        WHERE m.guild_id = ?
          AND m.event_id = ?
          AND r.res_a IS NOT NULL
          AND r.res_b IS NOT NULL

        GROUP BY
          m.id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of,
          r.res_a,
          r.res_b

        ORDER BY m.match_no ASC, m.id ASC
        `,
        [guildId, eventId],
      );

      const missingMapResults = [];

      for (const match of matchesWithResults) {
        const bestOf = Number(match.best_of);

        if (bestOf === 1) {
          continue;
        }

        const expectedMaps =
          Number(match.res_a || 0) + Number(match.res_b || 0);

        const actualMaps = Number(match.map_results || 0);

        if (expectedMaps !== actualMaps) {
          missingMapResults.push({
            ...match,
            expectedMaps,
            actualMaps,
          });
        }
      }

      // =====================================================
      // BRAKUJĄCE PUNKTY
      // =====================================================

      const [pointProblems] = await pool.query(
        `
        SELECT
          m.id,
          m.match_no,
          m.team_a,
          m.team_b,

          COUNT(DISTINCT p.user_id) AS prediction_users,

          COUNT(
            DISTINCT CASE
              WHEN mp.source = 'series'
              THEN mp.user_id
            END
          ) AS point_users

        FROM matches m

        INNER JOIN match_results r
          ON r.match_id = m.id
         AND r.guild_id = m.guild_id
         AND r.event_id = m.event_id

        INNER JOIN match_predictions p
          ON p.match_id = m.id
         AND p.guild_id = m.guild_id
         AND p.event_id = m.event_id

        LEFT JOIN match_points mp
          ON mp.match_id = m.id
         AND mp.guild_id = m.guild_id
         AND mp.event_id = m.event_id

        WHERE m.guild_id = ?
          AND m.event_id = ?
          AND r.res_a IS NOT NULL
          AND r.res_b IS NOT NULL

        GROUP BY
          m.id,
          m.match_no,
          m.team_a,
          m.team_b

        HAVING prediction_users <> point_users

        ORDER BY m.match_no ASC, m.id ASC
        `,
        [guildId, eventId],
      );

      let missingPointRows = 0;

      for (const match of pointProblems) {
        missingPointRows +=
          Number(match.prediction_users) - Number(match.point_users);
      }

      // =====================================================
      // LICZENIE BŁĘDÓW
      // =====================================================

      const activePhasePanelCount = Number(
        panelStats?.current_phase_active || 0,
      );

      const stalePendingEdits = Number(pendingEditStats?.stale || 0);

      const systemWarnings =
        (activePhasePanelCount === 0 ? 1 : 0) +
        (activePhasePanelCount > 1 ? 1 : 0) +
        (phasePanelMessageChecked && !phasePanelMessageOk ? 1 : 0) +
        overdueUnlockedMatches.length +
        stalePendingEdits;

      const errors =
        invalidBestOfMatches.length +
        invalidResults.length +
        missingMapResults.length +
        missingPointRows;

      const warnings =
        matchesWithoutTime.length +
        missingMapPredictions.length +
        systemWarnings;

      let color;
      let status;

      if (errors > 0) {
        color = 0xed4245;
        status = "❌ Wykryto problemy";
      } else if (warnings > 0) {
        color = 0xfee75c;
        status = "⚠️ Wymaga uwagi";
      } else {
        color = 0x57f287;
        status = "✅ Wszystko wygląda poprawnie";
      }

      // =====================================================
      // SZCZEGÓŁY PROBLEMÓW
      // =====================================================

      const problemLines = [];

      for (const match of matchesWithoutTime) {
        problemLines.push(
          `⚠️ **${getMatchLabel(match)}**\n` + `└ Brak godziny rozpoczęcia`,
        );
      }

      for (const match of invalidBestOfMatches) {
        problemLines.push(
          `❌ **${getMatchLabel(match)}**\n` +
            `└ Niepoprawne BO: **${match.best_of}**`,
        );
      }

      for (const match of invalidResults) {
        problemLines.push(
          `❌ **${getMatchLabel(match)}**\n` +
            `└ Wynik **${match.res_a}:${match.res_b}** ` +
            `jest niepoprawny dla BO${match.best_of}`,
        );
      }

      for (const match of missingMapResults) {
        problemLines.push(
          `❌ **${getMatchLabel(match)}**\n` +
            `└ Wyniki map: **${match.actualMaps}/${match.expectedMaps}**`,
        );
      }

      for (const row of missingMapPredictions) {
        problemLines.push(
          `⚠️ **${getMatchLabel(row)}**\n` +
            `└ <@${row.user_id}> ma typ serii, ale brak typów map`,
        );
      }

      if (activePhasePanelCount === 0) {
        problemLines.push(
          `⚠️ **Panel fazy ${event.phase}**\n` +
            `└ Brak aktywnego panelu fazy w bazie`,
        );
      } else if (activePhasePanelCount > 1) {
        problemLines.push(
          `⚠️ **Panel fazy ${event.phase}**\n` +
            `└ Aktywne panele: **${activePhasePanelCount}** (powinien być 1)`,
        );
      }

      if (phasePanelMessageChecked && !phasePanelMessageOk) {
        problemLines.push(
          `⚠️ **Panel fazy ${event.phase}**\n` +
            `└ Wpis istnieje w bazie, ale wiadomości nie znaleziono na Discordzie`,
        );
      }

      for (const match of overdueUnlockedMatches) {
        problemLines.push(
          `⚠️ **${getMatchLabel(match)}**\n` +
            `└ Mecz już się rozpoczął, ale nadal nie jest zablokowany`,
        );
      }

      if (stalePendingEdits > 0) {
        problemLines.push(
          `⚠️ **Pending edycje meczów**\n` +
            `└ Starsze niż 1 godzinę: **${stalePendingEdits}**`,
        );
      }

      for (const match of pointProblems) {
        const missing =
          Number(match.prediction_users) - Number(match.point_users);

        problemLines.push(
          `❌ **${getMatchLabel(match)}**\n` +
            `└ Brakuje punktów za serię dla **${missing}** użytkownik${missing === 1 ? "a" : "ów"}`,
        );
      }

      // Discord: limit 1024 znaków na value pola.
      const visibleProblems = [];
      let usedLength = 0;

      for (const line of problemLines) {
        if (usedLength + line.length + 1 > 900) {
          break;
        }

        visibleProblems.push(line);
        usedLength += line.length + 1;
      }

      const hiddenProblems = problemLines.length - visibleProblems.length;

      let problemsText = visibleProblems.join("\n");

      if (hiddenProblems > 0) {
        problemsText += `\n\n…oraz **${hiddenProblems}** kolejnych problemów.`;
      }

      // =====================================================
      // STAN SYSTEMU — FORMATOWANIE
      // =====================================================

      const activePanelsTotal = Number(panelStats?.active_total || 0);
      const matchPanelsTotal = Number(matchPanelStats?.with_panel || 0);
      const totalMatches = Number(matchPanelStats?.total || 0);
      const pendingEditsTotal = Number(pendingEditStats?.total || 0);

      let phasePanelText = "⚠️ brak aktywnego panelu";

      if (activePhasePanelCount === 1) {
        phasePanelText = phasePanelMessageChecked
          ? phasePanelMessageOk
            ? "✅ aktywny i dostępny"
            : "⚠️ wpis w DB, brak wiadomości"
          : "⚠️ aktywny, brak ID wiadomości";
      } else if (activePhasePanelCount > 1) {
        phasePanelText = `⚠️ ${activePhasePanelCount} aktywne panele`;
      }

      let deadlineText = "brak";

      if (activePhasePanel?.deadline) {
        const deadlineDate = new Date(activePhasePanel.deadline);

        if (!Number.isNaN(deadlineDate.getTime())) {
          deadlineText = new Intl.DateTimeFormat("pl-PL", {
            timeZone: "Europe/Warsaw",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(deadlineDate);
        } else {
          deadlineText = String(activePhasePanel.deadline);
        }
      }

      // =====================================================
      // EMBED
      // =====================================================

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("🔍 Audyt eventu")
        .setDescription(
          `**${event.name}**\n` +
            `Status eventu: **${event.status}**\n` +
            `Faza: **${event.phase}**\n\n` +
            `**${status}**`,
        )
        .addFields(
          {
            name: "🎮 Mecze",
            value:
              `Wszystkie: **${Number(matchStats?.total || 0)}**\n` +
              `Z wynikiem: **${Number(resultStats?.total || 0)}**\n` +
              `Zablokowane: **${Number(matchStats?.locked || 0)}**\n` +
              `Bez godziny: **${matchesWithoutTime.length}**\n` +
              `Niepoprawne BO: **${invalidBestOfMatches.length}**\n` +
              `Niepoprawne wyniki: **${invalidResults.length}**\n` +
              `Problemy z wynikami map: **${missingMapResults.length}**`,
            inline: true,
          },

          {
            name: "🎯 Typy",
            value:
              `Typy serii: **${Number(predictionStats?.total || 0)}**\n` +
              `Użytkownicy: **${Number(predictionStats?.users || 0)}**\n` +
              `Bez typów map: **${missingMapPredictions.length}**`,
            inline: true,
          },

          {
            name: "⭐ Punktacja",
            value: `Brakujące wpisy: **${missingPointRows}**`,
            inline: true,
          },

          {
            name: "⚙️ Stan systemu",
            value:
              `🗄️ Baza danych: **✅ OK**\n` +
              `📨 Panel fazy: **${phasePanelText}**\n` +
              `📌 Aktywne panele: **${activePanelsTotal}**\n` +
              `⏰ Deadline fazy: **${deadlineText}**\n` +
              `🎮 Panele meczów: **${matchPanelsTotal}/${totalMatches}**\n` +
              `🔓 Po czasie bez locka: **${overdueUnlockedMatches.length}**\n` +
              `📝 Pending edits: **${pendingEditsTotal}**` +
              (stalePendingEdits > 0
                ? ` (stare: **${stalePendingEdits}**)`
                : ""),
            inline: false,
          },
        );

      if (problemLines.length > 0) {
        embed.addFields({
          name: "⚠️ Szczegóły",
          value: problemsText,
        });
      } else {
        embed.addFields({
          name: "✅ Kontrola",
          value: "Nie wykryto żadnych problemów ani ostrzeżeń.",
        });
      }

      embed.setFooter({
        text:
          `Błędy: ${errors} • ` +
          `Ostrzeżenia: ${warnings} • ` +
          `Event ID: ${eventId}`,
      });

      // =====================================================
      // PRZYCISKI
      // =====================================================

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("panel:audit:refresh")
          .setLabel("Odśwież")
          .setEmoji("🔄")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("panel:audit:match")
          .setLabel("Sprawdź mecz")
          .setEmoji("🎮")
          .setStyle(ButtonStyle.Secondary),
      );

      return interaction.editReply({
        content: null,
        embeds: [embed],
        components: [row],
      });
    });
  } catch (err) {
    logError("audit", "eventAudit failed", {
      guildId: interaction.guildId,
      userId: interaction.user?.id || null,
      message: err.message,
      stack: err.stack,
    });

    const payload = {
      content: "❌ Nie udało się wykonać audytu eventu.",
      embeds: [],
      components: [],
    };

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(payload);
    }

    return interaction.reply({
      ...payload,
      ephemeral: true,
    });
  }
};
