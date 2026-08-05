const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const { withGuild } = require('../../utils/guildContext');
const { logError } = require('../../utils/logger');
const { getMapLabel } = require('../../utils/mapLabels');

const PAGE_SIZE = 5;

function formatMatchPrediction(match, maps) {
  const header =
    `${match.match_no ? `#${match.match_no} ` : ''}` +
    `${match.team_a} vs ${match.team_b} (Bo${match.best_of})`;

  if (match.pred_a == null || match.pred_b == null) {
    return [
      `🎮 **${header}**`,
      'Brak zapisanego typu.'
    ].join('\n');
  }

  const lines = [
    `✅ **${header}**`,
    `🏆 Typ: **${match.team_a} ${match.pred_a}:${match.pred_b} ${match.team_b}**`
  ];

  if (
    Number(match.best_of) === 1 &&
    match.pred_exact_a != null &&
    match.pred_exact_b != null
  ) {
    lines.push(
      `🗺️ Dokładny wynik: **${match.team_a} ` +
      `${match.pred_exact_a}:${match.pred_exact_b} ${match.team_b}**`
    );

    return lines.join('\n');
  }

  if (!maps.length) {
    lines.push('⚠️ Brak zapisanych wyników map.');
    return lines.join('\n');
  }

  lines.push('🗺️ Wyniki map:');

  for (const map of maps) {
    const mapLabel = getMapLabel(
      map.map_no,
      match.best_of,
      match.team_a,
      match.team_b
    );

    lines.push(
      `• **${mapLabel}:** ` +
      `${match.team_a} ${map.pred_exact_a}:${map.pred_exact_b} ${match.team_b}`
    );
  }

  return lines.join('\n');
}

module.exports = async function showMyPredictions(interaction) {
  try {
    const customId = String(interaction.customId || '');

    const [
      action,
      phaseKey,
      rawEventId,
      rawPage
    ] = customId.split(':');

    if (action !== 'my_predictions') return;

    const eventId = Number(rawEventId);
    const page = Math.max(0, Number(rawPage) || 0);

    if (!phaseKey || !eventId) {
      return interaction.reply({
        content: '❌ Brak informacji o evencie lub fazie.',
        ephemeral: true
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({
        ephemeral: true
      });
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      const [[event]] = await pool.query(
        `
        SELECT id, name
        FROM events
        WHERE id = ?
          AND guild_id = ?
        LIMIT 1
        `,
        [eventId, guildId]
      );

      if (!event) {
        return interaction.editReply({
          content: '❌ Nie znaleziono tego eventu.',
          components: [],
          embeds: []
        });
      }

      const [[countRow]] = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM matches
        WHERE guild_id = ?
          AND event_id = ?
          AND phase = ?
        `,
        [guildId, eventId, phaseKey]
      );

      const totalMatches = Number(countRow?.total || 0);

      if (!totalMatches) {
        return interaction.editReply({
          content: `Brak meczów dla fazy **${phaseKey}**.`,
          components: [],
          embeds: []
        });
      }

      const totalPages = Math.max(
        1,
        Math.ceil(totalMatches / PAGE_SIZE)
      );

      const safePage = Math.min(page, totalPages - 1);
      const offset = safePage * PAGE_SIZE;

      const [matches] = await pool.query(
        `
        SELECT
          m.id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of,

          mp.pred_a,
          mp.pred_b,
          mp.pred_exact_a,
          mp.pred_exact_b

        FROM matches m

        LEFT JOIN match_predictions mp
          ON mp.guild_id = m.guild_id
          AND mp.match_id = m.id
          AND mp.user_id = ?

        WHERE m.guild_id = ?
          AND m.event_id = ?
          AND m.phase = ?

        ORDER BY COALESCE(m.match_no, 999999), m.id
        LIMIT ? OFFSET ?
        `,
        [
          interaction.user.id,
          guildId,
          eventId,
          phaseKey,
          PAGE_SIZE,
          offset
        ]
      );

      const matchIds = matches.map((m) => Number(m.id));

      let maps = [];

      if (matchIds.length) {
        const placeholders = matchIds.map(() => '?').join(', ');

        const [mapRows] = await pool.query(
          `
          SELECT
            match_id,
            map_no,
            pred_exact_a,
            pred_exact_b
          FROM match_map_predictions
          WHERE guild_id = ?
            AND user_id = ?
            AND match_id IN (${placeholders})
          ORDER BY match_id, map_no
          `,
          [
            guildId,
            interaction.user.id,
            ...matchIds
          ]
        );

        maps = mapRows;
      }

      const mapsByMatch = new Map();

      for (const map of maps) {
        const key = Number(map.match_id);

        if (!mapsByMatch.has(key)) {
          mapsByMatch.set(key, []);
        }

        mapsByMatch.get(key).push(map);
      }

      const blocks = matches.map((match) => {
        const matchMaps =
          mapsByMatch.get(Number(match.id)) || [];

        return formatMatchPrediction(match, matchMaps);
      });

      const embed = new EmbedBuilder()
        .setTitle(`📋 Twoje typy — ${event.name}`)
        .setDescription(
          blocks.join('\n\n━━━━━━━━━━━━━━\n\n')
        )
        .setFooter({
          text:
            `Faza: ${phaseKey} • ` +
            `Strona ${safePage + 1}/${totalPages}`
        })
        .setColor('Blue');

      const buttons = [];

      if (safePage > 0) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(
              `my_predictions:${phaseKey}:${eventId}:${safePage - 1}`
            )
            .setLabel('⬅️ Poprzednia')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      buttons.push(
        new ButtonBuilder()
          .setCustomId(`match_pick:${phaseKey}`)
          .setLabel('🎯 Typuj mecze')
          .setStyle(ButtonStyle.Success)
      );

      if (safePage < totalPages - 1) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(
              `my_predictions:${phaseKey}:${eventId}:${safePage + 1}`
            )
            .setLabel('Następna ➡️')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      return interaction.editReply({
        content: '',
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(buttons)
        ]
      });
    });
  } catch (err) {
    logError('matches', 'showMyPredictions failed', {
      message: err.message,
      stack: err.stack
    });

    try {
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({
          content: '❌ Nie udało się pobrać Twoich typów.',
          ephemeral: true
        });
      }

      return interaction.editReply({
        content: '❌ Nie udało się pobrać Twoich typów.',
        embeds: [],
        components: []
      });
    } catch (_) {
      return null;
    }
  }
};