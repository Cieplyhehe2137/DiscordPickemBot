const { withGuild } = require('../utils/guildContext');

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
  const [[eventRow]] = await pool.query(
    `
    SELECT id
    FROM events
    WHERE guild_id = ?
      AND status = 'OPEN'
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId]
  );

  return eventRow?.id || null;
}

module.exports = async function mvpCandidatesModalSubmit(interaction) {
  try {
    if (!interaction.isModalSubmit()) return;

    const match = String(interaction.customId).match(
      /^mvp_admin_candidates_modal:(\d+)$/
    );

    const isLegacyModal = interaction.customId === 'mvp:candidates:modal';

    if (!match && !isLegacyModal) return;

    const raw =
      getTextInputValueSafe(interaction, 'mvp_candidates_input') ||
      getTextInputValueSafe(interaction, 'mvp_candidates');

    const candidates = parseMvpCandidates(raw);

    if (!candidates.length) {
      return interaction.reply({
        content: '❌ Nie podano żadnych poprawnych kandydatów MVP.',
        ephemeral: true
      });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const eventId = match
        ? Number(match[1])
        : await resolveActiveEventId(pool, guildId);

      if (!eventId) {
        return interaction.reply({
          content: '❌ Nie znaleziono aktywnego eventu.',
          ephemeral: true
        });
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

    const preview = candidates
      .slice(0, 20)
      .map(c => `• ${c.nickname}${c.team_name ? ` (${c.team_name})` : ''}`)
      .join('\n');

    const more =
      candidates.length > 20
        ? `\n...i jeszcze ${candidates.length - 20}`
        : '';

    return interaction.reply({
      content:
        `✅ Zapisano kandydatów MVP: ${candidates.length}\n\n` +
        `${preview}${more}`,
      ephemeral: true
    });
  } catch (err) {
    console.error('mvpCandidatesModalSubmit failed:', err);

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        content: '❌ Nie udało się zapisać kandydatów MVP.',
        ephemeral: true
      }).catch(() => {});
    }

    return interaction.reply({
      content: '❌ Nie udało się zapisać kandydatów MVP.',
      ephemeral: true
    }).catch(() => {});
  }
};