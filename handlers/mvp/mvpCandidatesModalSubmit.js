const { withGuild } = require('../../utils/guildContext');
const { getOpenEventId } = require('../../utils/getOpenEventId');

function parseMvpCandidates(raw) {
  return String(raw)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line
        .split('|')
        .map(v => v.trim())
        .filter(Boolean);

      return {
        nickname: parts[0] || null,
        team_name: parts[1] || null
      };
    })
    .filter(x => x.nickname);
}

function getTextInputValueSafe(interaction, customId) {
  try {
    return interaction.fields.getTextInputValue(customId);
  } catch (_) {
    return '';
  }
}

async function resolveActiveEventId(pool, guildId) {
  return getOpenEventId(pool, guildId);
}

module.exports = async function mvpCandidatesModalSubmit(interaction) {
  try {
    if (!interaction.isModalSubmit()) return;

    const match = String(interaction.customId).match(
      /^mvp_admin_candidates_modal:(\d+)$/
    );

    const isLegacyModal = interaction.customId === 'mvp:candidates:modal';

    if (!match && !isLegacyModal) return;

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const raw =
      getTextInputValueSafe(interaction, 'mvp_candidates_input') ||
      getTextInputValueSafe(interaction, 'mvp_candidates');

    const candidates = parseMvpCandidates(raw);

    if (!candidates.length) {
      return interaction.editReply({
        content: '❌ Nie podano żadnych poprawnych kandydatów MVP.'
      });
    }

    let savedEventId = null;

    await withGuild(interaction, async ({ pool, guildId }) => {
      const eventId = match
        ? Number(match[1])
        : await resolveActiveEventId(pool, guildId);

      savedEventId = eventId;

      if (!eventId) {
        return;
      }

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        await conn.query(
          `
          UPDATE mvp_candidates
          SET is_active = 0
          WHERE guild_id = ?
            AND event_id = ?
          `,
          [guildId, eventId]
        );

        for (const c of candidates) {
          await conn.query(
            `
            INSERT INTO mvp_candidates (
              guild_id,
              event_id,
              nickname,
              team_name,
              is_active
            )
            VALUES (?, ?, ?, ?, 1)
            `,
            [guildId, eventId, c.nickname, c.team_name]
          );
        }

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    });

    if (!savedEventId) {
      return interaction.editReply({
        content: '❌ Nie znaleziono aktywnego eventu.'
      });
    }

    const preview = candidates
      .slice(0, 20)
      .map(c => `• ${c.nickname}${c.team_name ? ` (${c.team_name})` : ''}`)
      .join('\n');

    const more =
      candidates.length > 20
        ? `\n...i jeszcze ${candidates.length - 20}`
        : '';

    return interaction.editReply({
      content:
        `✅ Zapisano kandydatów MVP: ${candidates.length}\n\n` +
        `${preview}${more}`
    });
  } catch (err) {
    console.error('mvpCandidatesModalSubmit failed:', err);

    if (interaction.replied || interaction.deferred) {
      return interaction.editReply({
        content: '❌ Nie udało się zapisać kandydatów MVP.'
      }).catch(() => {});
    }

    return interaction.reply({
      content: '❌ Nie udało się zapisać kandydatów MVP.',
      ephemeral: true
    }).catch(() => {});
  }
};