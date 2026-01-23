// handlers/matchUserExactOpen.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');
const userState = require('../utils/matchUserState');

/* ===============================
   HELPERS
   =============================== */

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

async function getUserDefaults(pool, matchId, userId, maxMaps, mapNo) {
  if (maxMaps === 1) {
    const [[p]] = await pool.query(
      `
      SELECT pred_exact_a, pred_exact_b
      FROM match_predictions
      WHERE guild_id = ?
        AND match_id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [pool.__guildId, matchId, userId]
    );

    return { a: p?.pred_exact_a ?? '', b: p?.pred_exact_b ?? '' };
  }

  const [[p]] = await pool.query(
    `
    SELECT pred_exact_a, pred_exact_b
    FROM match_map_predictions
    WHERE guild_id = ?
      AND match_id = ?
      AND user_id = ?
      AND map_no = ?
    LIMIT 1
    `,
    [pool.__guildId, matchId, userId, mapNo]
  );

  return { a: p?.pred_exact_a ?? '', b: p?.pred_exact_b ?? '' };
}

function buildModal({ match, maxMaps, mapNo, defaults }) {
  const modal = new ModalBuilder()
    .setCustomId('match_user_exact_submit')
    .setTitle(
      maxMaps === 1
        ? `Dokładny wynik: ${match.team_a} vs ${match.team_b}`
        : `Dokładny wynik — mapa #${mapNo}`
    );

  const inA = new TextInputBuilder()
    .setCustomId('exact_a')
    .setLabel(`${match.team_a} — wynik`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('np. 13')
    .setValue(defaults.a === '' ? '' : String(defaults.a));

  const inB = new TextInputBuilder()
    .setCustomId('exact_b')
    .setLabel(`${match.team_b} — wynik`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('np. 8')
    .setValue(defaults.b === '' ? '' : String(defaults.b));

  modal.addComponents(
    new ActionRowBuilder().addComponents(inA),
    new ActionRowBuilder().addComponents(inB)
  );

  return modal;
}

/* ===============================
   HANDLER
   =============================== */

module.exports = async function matchUserExactOpen(interaction) {
  try {
    const ctx = userState.get(interaction.guildId, interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({
        content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz.',
        ephemeral: true,
      });
    }

    await withGuild(interaction, async (pool, guildId) => {
      // 👇 mały trick, żeby helper wiedział jaki guild_id
      pool.__guildId = guildId;

      const [[match]] = await pool.query(
        `
        SELECT id, team_a, team_b, best_of, is_locked
        FROM matches
        WHERE guild_id = ?
          AND id = ?
        LIMIT 1
        `,
        [guildId, ctx.matchId]
      );

      if (!match) {
        userState.clear(guildId, interaction.user.id);
        return interaction.reply({
          content: '❌ Mecz nie istnieje.',
          ephemeral: true
        });
      }

      if (match.is_locked) {
        return interaction.reply({
          content: '🔒 Ten mecz jest zablokowany.',
          ephemeral: true
        });
      }

      const maxMaps = maxMapsFromBo(match.best_of);

      let mapNo = Number(ctx.mapNo || 0);
      if (maxMaps > 1 && (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps)) {
        mapNo = 1;
        userState.set(guildId, interaction.user.id, { ...ctx, mapNo });
      }

      const effectiveMapNo = maxMaps === 1 ? 1 : mapNo;

      if (maxMaps > 1 && effectiveMapNo === 1 && !ctx?.requiredMaps) {
        return interaction.reply({
          content:
            '🎯 Najpierw wybierz wynik serii w dropdownie **„Wybierz swój typ…”**.',
          ephemeral: true,
        });
      }

      if (maxMaps > 1 && effectiveMapNo === 1) {
        userState.set(guildId, interaction.user.id, {
          ...ctx,
          matchId: match.id,
          mapNo: 1,
          mapWinsA: 0,
          mapWinsB: 0,
        });
      }

      const defaults = await getUserDefaults(
        pool,
        match.id,
        interaction.user.id,
        maxMaps,
        effectiveMapNo
      );

      const modal = buildModal({
        match,
        maxMaps,
        mapNo: effectiveMapNo,
        defaults
      });

      return interaction.showModal(modal);
    });
  } catch (err) {
    logger.error('matches', 'matchUserExactOpen failed', {
      message: err.message,
      stack: err.stack
    });

    return interaction
      .reply({
        content: '❌ Nie udało się otworzyć modala.',
        ephemeral: true
      })
      .catch(() => {});
  }
};
