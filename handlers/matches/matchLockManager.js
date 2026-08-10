const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const { withGuild } = require('../../utils/guildContext');
const { logError } = require('../../utils/logger');
const {
  isMatchLocked,
  isMatchStarted
} = require('../../utils/matchLock');

function isAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    ) ||
    interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild
    )
  );
}

function getMode(match) {
  if (match.lock_override === null) {
    return '⚙️ AUTO';
  }

  if (Number(match.lock_override) === 1) {
    return '🔒 LOCK';
  }

  return '🔓 UNLOCK';
}

module.exports = async function matchLockManager(interaction) {
  try {
    if (!isAdmin(interaction)) {
      return interaction.editReply({
        content: '⛔ Brak uprawnień.',
        embeds: [],
        components: []
      });
    }

    return withGuild(interaction, async ({
      pool,
      guildId
    }) => {

      const [matches] = await pool.query(
        `
        SELECT
          id,
          event_id,
          phase,
          match_no,
          team_a,
          team_b,
          best_of,
          start_time_utc,
          is_locked,
          lock_override
        FROM matches
        WHERE guild_id = ?
        ORDER BY id DESC
        LIMIT 25
        `,
        [guildId]
      );

      if (!matches.length) {
        return interaction.editReply({
          content: '❌ Brak meczów.',
          embeds: [],
          components: []
        });
      }

      const options = matches.map((match) => {

        const actuallyLocked =
          isMatchLocked(match);

        const started =
          isMatchStarted(match);

        return {
          label:
            `${match.team_a} vs ${match.team_b}`
              .slice(0, 100),

          description:
            `#${match.match_no || match.id} • ` +
            `${match.phase} • ` +
            `${getMode(match)} • ` +
            `${actuallyLocked ? 'ZAMKNIĘTY' : 'OTWARTY'}` +
            `${started ? ' • STARTED' : ''}`
              .slice(0, 100),

          value: String(match.id),

          emoji: actuallyLocked
            ? '🔒'
            : '🔓'
        };
      });

      const select =
        new StringSelectMenuBuilder()
          .setCustomId('match_lock_select')
          .setPlaceholder(
            'Wybierz mecz do zarządzania'
          )
          .addOptions(options);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🔐 Zarządzanie blokadami meczów')
        .setDescription(
          'Wybierz mecz poniżej.\n\n' +

          '⚙️ **AUTO** — standardowa blokada wg czasu\n' +
          '🔒 **LOCK** — wymuszona blokada\n' +
          '🔓 **UNLOCK** — wymuszone otwarcie\n\n' +

          '⚠️ **UNLOCK pozwala typować nawet po ' +
          'planowanej godzinie rozpoczęcia meczu.**'
        );

      return interaction.editReply({
        content: '',
        embeds: [embed],
        components: [
          new ActionRowBuilder()
            .addComponents(select)
        ]
      });
    });

  } catch (err) {
    logError(
      'matches',
      'matchLockManager failed',
      {
        message: err.message,
        stack: err.stack
      }
    );

    return interaction.editReply({
      content:
        '❌ Nie udało się otworzyć zarządzania blokadami.',
      embeds: [],
      components: []
    }).catch(() => {});
  }
};