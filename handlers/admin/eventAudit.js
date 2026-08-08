const {
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const { withGuild } = require('../../utils/guildContext');
const { getActiveEventId } = require('../../utils/getOpenEventId');
const { logError } = require('../../utils/logger');

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );
}

module.exports = async function eventAudit(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: '⛔ Tylko administracja.',
      ephemeral: true,
    });
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({
      ephemeral: true,
    });
  }

  try {
    return withGuild(interaction, async ({ guildId, pool }) => {
      const eventId = await getActiveEventId(pool, guildId);

      if (!eventId) {
        return interaction.editReply({
          content: '❌ Nie znaleziono aktywnego eventu.',
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
        [guildId, eventId]
      );

      if (!event) {
        return interaction.editReply({
          content: '❌ Nie znaleziono danych eventu.',
        });
      }

      /* =========================
         MECZE
      ========================= */

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
        [guildId, eventId]
      );

      const [[resultStats]] = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM match_results
        WHERE guild_id = ?
          AND event_id = ?
          AND res_a IS NOT NULL
          AND res_b IS NOT NULL
        `,
        [guildId, eventId]
      );

      /* =========================
         NIEPOPRAWNE WYNIKI SERII
      ========================= */

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
        `,
        [guildId, eventId]
      );

      const invalidResults = [];

      for (const match of results) {
        const bestOf = Number(match.best_of);
        const a = Number(match.res_a);
        const b = Number(match.res_b);

        let valid = true;

        if (bestOf === 1) {
          valid =
            (a === 1 && b === 0) ||
            (a === 0 && b === 1);
        }

        if (bestOf === 3) {
          valid =
            (a === 2 && b >= 0 && b <= 1) ||
            (b === 2 && a >= 0 && a <= 1);
        }

        if (bestOf === 5) {
          valid =
            (a === 3 && b >= 0 && b <= 2) ||
            (b === 3 && a >= 0 && a <= 2);
        }

        if (!valid) {
          invalidResults.push(match);
        }
      }

      /* =========================
         TYPY
      ========================= */

      const [[predictionStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT user_id) AS users

        FROM match_predictions

        WHERE guild_id = ?
          AND event_id = ?
        `,
        [guildId, eventId]
      );

      /* =========================
         BO3 / BO5:
         typ serii bez żadnych map
      ========================= */

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
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of

        HAVING COUNT(mp.id) = 0
        `,
        [guildId, eventId]
      );

      /* =========================
         WYNIKI MAP
      ========================= */

      const [finishedBoMatches] = await pool.query(
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
          AND m.best_of IN (3, 5)
          AND r.res_a IS NOT NULL
          AND r.res_b IS NOT NULL
        `,
        [guildId, eventId]
      );

      const missingMapResults = [];

      for (const match of finishedBoMatches) {
        const expectedMaps =
          Number(match.res_a) + Number(match.res_b);

        const [[row]] = await pool.query(
          `
          SELECT COUNT(*) AS total
          FROM match_map_results
          WHERE guild_id = ?
            AND event_id = ?
            AND match_id = ?
            AND exact_a IS NOT NULL
            AND exact_b IS NOT NULL
          `,
          [guildId, eventId, match.id]
        );

        const actualMaps = Number(row?.total || 0);

        if (actualMaps !== expectedMaps) {
          missingMapResults.push({
            ...match,
            expectedMaps,
            actualMaps,
          });
        }
      }

      /* =========================
         PUNKTY
      ========================= */

      const [finishedMatches] = await pool.query(
        `
        SELECT
          m.id,
          m.best_of

        FROM matches m

        INNER JOIN match_results r
          ON r.match_id = m.id
         AND r.guild_id = m.guild_id
         AND r.event_id = m.event_id

        WHERE m.guild_id = ?
          AND m.event_id = ?
          AND r.res_a IS NOT NULL
          AND r.res_b IS NOT NULL
        `,
        [guildId, eventId]
      );

      let missingPointRows = 0;

      for (const match of finishedMatches) {
        const [[pred]] = await pool.query(
          `
          SELECT COUNT(*) AS total
          FROM match_predictions
          WHERE guild_id = ?
            AND event_id = ?
            AND match_id = ?
          `,
          [guildId, eventId, match.id]
        );

        const [[points]] = await pool.query(
          `
          SELECT
            COUNT(DISTINCT user_id) AS users
          FROM match_points
          WHERE guild_id = ?
            AND event_id = ?
            AND match_id = ?
            AND source = 'series'
          `,
          [guildId, eventId, match.id]
        );

        const predictionUsers = Number(pred?.total || 0);
        const pointUsers = Number(points?.users || 0);

        if (pointUsers < predictionUsers) {
          missingPointRows += predictionUsers - pointUsers;
        }
      }

      /* =========================
         STATUS
      ========================= */

      const errors =
        Number(matchStats?.invalid_best_of || 0) +
        invalidResults.length +
        missingMapResults.length +
        missingPointRows;

      const warnings =
        Number(matchStats?.without_start_time || 0) +
        missingMapPredictions.length;

      const color =
        errors > 0
          ? 0xed4245
          : warnings > 0
            ? 0xfee75c
            : 0x57f287;

      const status =
        errors > 0
          ? '❌ Wykryto problemy'
          : warnings > 0
            ? '⚠️ Wymaga uwagi'
            : '✅ Wszystko wygląda poprawnie';

      const lines = [];

      if (invalidResults.length) {
        for (const match of invalidResults.slice(0, 5)) {
          lines.push(
            `❌ #${match.match_no ?? match.id} ` +
            `${match.team_a} vs ${match.team_b} — ` +
            `wynik ${match.res_a}:${match.res_b} dla BO${match.best_of}`
          );
        }
      }

      if (missingMapResults.length) {
        for (const match of missingMapResults.slice(0, 5)) {
          lines.push(
            `❌ #${match.match_no ?? match.id} ` +
            `${match.team_a} vs ${match.team_b} — ` +
            `mapy ${match.actualMaps}/${match.expectedMaps}`
          );
        }
      }

      if (missingMapPredictions.length) {
        lines.push(
          `⚠️ ${missingMapPredictions.length} typów serii ` +
          `BO3/BO5 nie ma żadnego typu map`
        );
      }

      if (missingPointRows > 0) {
        lines.push(
          `❌ ${missingPointRows} typów zakończonych meczów ` +
          `nie ma punktów za serię`
        );
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🔍 Audyt eventu')
        .setDescription(
          `**${event.name}**\n` +
          `Status eventu: **${event.status}**\n` +
          `Faza: **${event.phase}**\n\n` +
          `**${status}**`
        )
        .addFields(
          {
            name: '🎮 Mecze',
            value:
              `Wszystkie: **${Number(matchStats?.total || 0)}**\n` +
              `Z wynikiem: **${Number(resultStats?.total || 0)}**\n` +
              `Zablokowane: **${Number(matchStats?.locked || 0)}**\n` +
              `Bez godziny: **${Number(matchStats?.without_start_time || 0)}**\n` +
              `Niepoprawne BO: **${Number(matchStats?.invalid_best_of || 0)}**\n` +
              `Niepoprawne wyniki: **${invalidResults.length}**\n` +
              `Problemy z wynikami map: **${missingMapResults.length}**`,
            inline: true,
          },
          {
            name: '🎯 Typy',
            value:
              `Typy serii: **${Number(predictionStats?.total || 0)}**\n` +
              `Użytkownicy: **${Number(predictionStats?.users || 0)}**\n` +
              `Bez typów map: **${missingMapPredictions.length}**`,
            inline: true,
          },
          {
            name: '⭐ Punktacja',
            value:
              `Brakujące wpisy: **${missingPointRows}**`,
            inline: true,
          }
        );

      if (lines.length) {
        embed.addFields({
          name: '⚠️ Wykryte problemy',
          value: lines.slice(0, 10).join('\n').slice(0, 1024),
        });
      }

      embed.setFooter({
        text:
          `Błędy: ${errors} • Ostrzeżenia: ${warnings} • Event ID: ${eventId}`,
      });

      return interaction.editReply({
        embeds: [embed],
      });
    });
  } catch (err) {
    logError('audit', 'eventAudit failed', {
      guildId: interaction.guildId,
      userId: interaction.user?.id || null,
      message: err.message,
      stack: err.stack,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content: '❌ Nie udało się wykonać audytu eventu.',
        embeds: [],
        components: [],
      });
    }

    return interaction.reply({
      content: '❌ Nie udało się wykonać audytu eventu.',
      ephemeral: true,
    });
  }
};