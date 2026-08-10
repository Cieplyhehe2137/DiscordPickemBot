const {
  PermissionFlagsBits
} = require('discord.js');

const {
  withGuild
} = require('../../utils/guildContext');

const {
  logInfo,
  logError
} = require('../../utils/logger');

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

module.exports = async function matchLockSet(
  interaction
) {
  try {
    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: '⛔ Brak uprawnień.',
        ephemeral: true
      });
    }

    const parts =
      String(interaction.customId)
        .split(':');

    const matchId =
      Number(parts[1]);

    const mode =
      parts[2];

    if (
      !matchId ||
      !['auto', 'lock', 'unlock']
        .includes(mode)
    ) {
      return interaction.reply({
        content: '❌ Nieprawidłowa akcja.',
        ephemeral: true
      });
    }

    return withGuild(
      interaction,
      async ({ pool, guildId }) => {

        const [[match]] =
          await pool.query(
            `
            SELECT *
            FROM matches
            WHERE guild_id = ?
              AND id = ?
            LIMIT 1
            `,
            [guildId, matchId]
          );

        if (!match) {
          return interaction.reply({
            content:
              '❌ Nie znaleziono meczu.',
            ephemeral: true
          });
        }

        let override = null;

        if (mode === 'lock') {
          override = 1;
        }

        if (mode === 'unlock') {
          override = 0;
        }

        await pool.query(
          `
          UPDATE matches
          SET lock_override = ?
          WHERE guild_id = ?
            AND id = ?
          `,
          [
            override,
            guildId,
            matchId
          ]
        );

        logInfo(
          'matches',
          'Match lock override changed',
          {
            guildId,
            matchId,
            mode,
            by: interaction.user.id
          }
        );

        let message;

        if (mode === 'auto') {
          message =
            '⚙️ Przywrócono automatyczne ' +
            'sterowanie blokadą.';
        }

        if (mode === 'lock') {
          message =
            '🔒 Mecz został ręcznie zablokowany.';
        }

        if (mode === 'unlock') {
          message =
            '🔓 Mecz został ręcznie odblokowany.';
        }

        return interaction.update({
          content:
            `${message}\n\n` +
            `**${match.team_a} vs ${match.team_b}**`,
          embeds: [],
          components: []
        });
      }
    );

  } catch (err) {
    logError(
      'matches',
      'matchLockSet failed',
      {
        message: err.message,
        stack: err.stack
      }
    );

    return interaction.reply({
      content:
        '❌ Nie udało się zmienić blokady.',
      ephemeral: true
    }).catch(() => {});
  }
};