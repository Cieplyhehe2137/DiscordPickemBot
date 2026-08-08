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

module.exports = async function eventAuditMatch(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: '⛔ Tylko administracja.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({
    ephemeral: true,
  });

  try {
    return withGuild(interaction, async ({ guildId, pool }) => {
      const eventId = await getActiveEventId(pool, guildId);

      if (!eventId) {
        return interaction.editReply({
          content: '❌ Nie znaleziono aktywnego eventu.',
        });
      }

      const matchId = Number(interaction.values?.[0]);

      if (!Number.isInteger(matchId) || matchId <= 0) {
        return interaction.editReply({
          content: '❌ Niepoprawny identyfikator meczu.',
        });
      }

      /*
       * ==============================================
       * MECZ + WYNIK
       * ==============================================
       */

      const [[match]] = await pool.query(
        `
        SELECT
          m.id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of,
          m.is_locked,
          m.start_time_utc,
          r.res_a,
          r.res_b

        FROM matches m

        LEFT JOIN match_results r
          ON r.match_id = m.id
         AND r.guild_id = m.guild_id
         AND r.event_id = m.event_id

        WHERE m.guild_id = ?
          AND m.event_id = ?
          AND m.id = ?

        LIMIT 1
        `,
        [guildId, eventId, matchId]
      );

      if (!match) {
        return interaction.editReply({
          content: '❌ Nie znaleziono tego meczu.',
        });
      }

      /*
       * ==============================================
       * TYPY SERII
       * ==============================================
       */

      const [[predictionStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT user_id) AS users

        FROM match_predictions

        WHERE guild_id = ?
          AND event_id = ?
          AND match_id = ?
        `,
        [guildId, eventId, matchId]
      );

      /*
       * ==============================================
       * TYPY MAP
       * ==============================================
       */

      const [[mapPredictionStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT user_id) AS users

        FROM match_map_predictions

        WHERE guild_id = ?
          AND event_id = ?
          AND match_id = ?
        `,
        [guildId, eventId, matchId]
      );

      /*
       * ==============================================
       * WYNIKI MAP
       * ==============================================
       */

      const [mapResults] = await pool.query(
        `
        SELECT
          map_no,
          exact_a,
          exact_b

        FROM match_map_results

        WHERE guild_id = ?
          AND event_id = ?
          AND match_id = ?

        ORDER BY map_no ASC
        `,
        [guildId, eventId, matchId]
      );

      /*
       * ==============================================
       * PUNKTY
       * ==============================================
       */

      const [[pointStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS rows_count,
          COUNT(DISTINCT user_id) AS users,
          COALESCE(SUM(points), 0) AS total_points

        FROM match_points

        WHERE guild_id = ?
          AND event_id = ?
          AND match_id = ?
        `,
        [guildId, eventId, matchId]
      );

      const [[seriesPointStats]] = await pool.query(
        `
        SELECT
          COUNT(DISTINCT user_id) AS users

        FROM match_points

        WHERE guild_id = ?
          AND event_id = ?
          AND match_id = ?
          AND source = 'series'
        `,
        [guildId, eventId, matchId]
      );

      /*
       * ==============================================
       * NIEKOMPLETNE TYPY MAP
       * ==============================================
       */

      let usersWithoutMaps = 0;

      if ([3, 5].includes(Number(match.best_of))) {
        const [[missing]] = await pool.query(
          `
          SELECT COUNT(*) AS total
          FROM (
            SELECT p.user_id

            FROM match_predictions p

            LEFT JOIN match_map_predictions mp
              ON mp.guild_id = p.guild_id
             AND mp.event_id = p.event_id
             AND mp.match_id = p.match_id
             AND mp.user_id = p.user_id

            WHERE p.guild_id = ?
              AND p.event_id = ?
              AND p.match_id = ?

            GROUP BY p.user_id

            HAVING COUNT(mp.id) = 0
          ) x
          `,
          [guildId, eventId, matchId]
        );

        usersWithoutMaps = Number(missing?.total || 0);
      }

      /*
       * ==============================================
       * DIAGNOSTYKA
       * ==============================================
       */

      const problems = [];

      if (![1, 3, 5].includes(Number(match.best_of))) {
        problems.push(
          `❌ Niepoprawne BO: **${match.best_of}**`
        );
      }

      if (!match.start_time_utc) {
        problems.push(
          '⚠️ Brak godziny rozpoczęcia'
        );
      }

      if (usersWithoutMaps > 0) {
        problems.push(
          `⚠️ **${usersWithoutMaps}** użytkowników ma typ serii bez typów map`
        );
      }

      const hasResult =
        match.res_a !== null &&
        match.res_b !== null;

      if (hasResult) {
        const predictionUsers =
          Number(predictionStats?.users || 0);

        const seriesPointUsers =
          Number(seriesPointStats?.users || 0);

        if (seriesPointUsers < predictionUsers) {
          problems.push(
            `❌ Brak punktów za serię dla **${
              predictionUsers - seriesPointUsers
            }** użytkowników`
          );
        }

        if ([3, 5].includes(Number(match.best_of))) {
          const expectedMaps =
            Number(match.res_a) +
            Number(match.res_b);

          if (mapResults.length !== expectedMaps) {
            problems.push(
              `❌ Wyniki map: **${mapResults.length}/${expectedMaps}**`
            );
          }
        }
      }

      /*
       * ==============================================
       * STATUS
       * ==============================================
       */

      const hasError =
        problems.some(line => line.startsWith('❌'));

      const hasWarning =
        problems.some(line => line.startsWith('⚠️'));

      const color =
        hasError
          ? 0xed4245
          : hasWarning
            ? 0xfee75c
            : 0x57f287;

      const status =
        hasError
          ? '❌ Wykryto problemy'
          : hasWarning
            ? '⚠️ Wymaga uwagi'
            : '✅ Mecz wygląda poprawnie';

      /*
       * ==============================================
       * WYNIK
       * ==============================================
       */

      const resultText = hasResult
        ? `**${match.team_a} ${match.res_a}:${match.res_b} ${match.team_b}**`
        : '⏳ Brak wyniku';

      let mapResultText = 'Brak wyników map';

      if (mapResults.length) {
        mapResultText = mapResults
          .map(
            map =>
              `Mapa ${map.map_no}: **${match.team_a} ` +
              `${map.exact_a}:${map.exact_b} ${match.team_b}**`
          )
          .join('\n');
      }

      /*
       * ==============================================
       * EMBED
       * ==============================================
       */

      const matchNumber =
        match.match_no ?? match.id;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(
          `🎮 Diagnostyka meczu #${matchNumber}`
        )
        .setDescription(
          `**${match.team_a} vs ${match.team_b}**\n` +
          `BO${match.best_of}\n\n` +
          `**${status}**`
        )
        .addFields(
          {
            name: '⚙️ Stan',
            value:
              `Lock: **${
                Number(match.is_locked)
                  ? '🔒 TAK'
                  : '🔓 NIE'
              }**\n` +
              `Godzina: **${
                match.start_time_utc
                  ? match.start_time_utc
                  : 'BRAK'
              }**`,
            inline: true,
          },

          {
            name: '🎯 Typowanie',
            value:
              `Typy serii: **${Number(
                predictionStats?.total || 0
              )}**\n` +
              `Użytkownicy: **${Number(
                predictionStats?.users || 0
              )}**\n` +
              `Typy map: **${Number(
                mapPredictionStats?.total || 0
              )}**\n` +
              `Userzy z mapami: **${Number(
                mapPredictionStats?.users || 0
              )}**`,
            inline: true,
          },

          {
            name: '⭐ Punktacja',
            value:
              `Wpisy: **${Number(
                pointStats?.rows_count || 0
              )}**\n` +
              `Użytkownicy: **${Number(
                pointStats?.users || 0
              )}**\n` +
              `Łącznie pkt: **${Number(
                pointStats?.total_points || 0
              )}**`,
            inline: true,
          },

          {
            name: '🏆 Wynik serii',
            value: resultText,
          }
        );

      if ([3, 5].includes(Number(match.best_of))) {
        embed.addFields({
          name: '🗺️ Wyniki map',
          value: mapResultText.slice(0, 1024),
        });
      }

      if (problems.length) {
        embed.addFields({
          name: '⚠️ Diagnostyka',
          value: problems.join('\n').slice(0, 1024),
        });
      } else {
        embed.addFields({
          name: '✅ Diagnostyka',
          value:
            'Nie wykryto problemów z tym meczem.',
        });
      }

      embed.setFooter({
        text:
          `Match ID: ${match.id} • Event ID: ${eventId}`,
      });

      return interaction.editReply({
        embeds: [embed],
        components: [],
      });
    });
  } catch (err) {
    logError('audit', 'eventAuditMatch failed', {
      guildId: interaction.guildId,
      userId: interaction.user?.id || null,
      message: err.message,
      stack: err.stack,
    });

    return interaction.editReply({
      content:
        '❌ Nie udało się wykonać diagnostyki meczu.',
      embeds: [],
      components: [],
    });
  }
};