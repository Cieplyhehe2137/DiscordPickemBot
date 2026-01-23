const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');
const { isMatchLocked } = require('../utils/matchLock');

const PAGE_SIZE = 24; // 24 + 1 = Next/Prev

function safeLabel(s) {
  const str = String(s ?? '');
  if (!str) return 'mecz';
  return str.length > 100 ? str.slice(0, 97) + '…' : str;
}

function safeValue(s) {
  const str = String(s ?? '');
  return str.length > 100 ? str.slice(0, 100) : str;
}

// helper: bezpieczna odpowiedź
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

async function sendMatchList({ interaction, phaseKey, mode, page, isUpdate }) {
  const offset = page * PAGE_SIZE;

  return withGuild(interaction, async (pool, guildId) => {
    const [rows] = await pool.query(
      `
      SELECT id, match_no, team_a, team_b, best_of, is_locked, start_time_utc
      FROM matches
      WHERE guild_id = ?
        AND phase = ?
      ORDER BY COALESCE(match_no, 999999), id
      LIMIT ? OFFSET ?
      `,
      [guildId, phaseKey, PAGE_SIZE + 1, offset]
    );

    if (!rows.length) {
      return respond(
        interaction,
        { content: `Brak meczów dla fazy **${phaseKey}**.`, components: [] },
        isUpdate
      );
    }

    const hasNext = rows.length > PAGE_SIZE;
    const slice = rows.slice(0, PAGE_SIZE);

    const customId =
      mode === 'res'
        ? 'match_pick_select_res'
        : 'match_pick_select_pred';

    const options = slice.map((m) => {
      const locked = isMatchLocked(m);
      const label =
        `${m.match_no ? `#${m.match_no} ` : ''}` +
        `${m.team_a} vs ${m.team_b} (Bo${m.best_of})` +
        `${locked ? ' 🔒' : ''}`;

      return {
        label: safeLabel(label),
        value: safeValue(`MATCH|${phaseKey}|${m.id}`),
      };
    });

    if (hasNext) {
      options.push({
        label: safeLabel('➡️ Następna strona'),
        value: safeValue(`NEXT|${phaseKey}|${page + 1}`),
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder('Wybierz mecz...')
        .addOptions(options)
    );

    return respond(
      interaction,
      {
        content:
          mode === 'res'
            ? `🧾 Wybierz mecz, aby **wprowadzić oficjalny wynik** (faza: **${phaseKey}**)`
            : `🎯 Wybierz mecz do **wytypowania wyniku** (faza: **${phaseKey}**)`,
        components: [row],
      },
      isUpdate
    );
  });
}

module.exports = async function openMatchPick(interaction) {
  try {
    const customId = interaction.customId || '';
    const phaseKey = customId.split(':')[1];

    if (!phaseKey) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }
      return interaction.editReply({
        content: '❌ Brak phaseKey w CustomId',
        components: [],
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    await sendMatchList({
      interaction,
      phaseKey,
      mode: 'pred',
      page: 0,
      isUpdate: false,
    });
  } catch (err) {
    logger.error('matches', 'openMatchPick failed', {
      message: err.message,
      stack: err.stack,
    });

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }
      await interaction.editReply({
        content: '❌ Błąd przy ładowaniu listy meczów.',
        components: [],
      });
    } catch (_) {}
  }
};

// eksport helpera (używany np. w NEXT)
module.exports.sendMatchList = sendMatchList;
