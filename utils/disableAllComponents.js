const db = require('../db');
const { getAllGuildIds } = require('./guildRegistry');
const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');

const { buildPopularityEmbedGrouped } = require('./popularityEmbed');
const { calculatePopularityForPanel } = require('./calcPopularityAll');
const { safeQuery } = require('./safeQuery');

/* ======================================================
   🧯 ANTY-OVERLAP
   ====================================================== */
let _closeExpiredPanelsRunningGlobal = false;
const _closeExpiredPanelsRunningByGuild = new Set();

/* ====================================================== */

function prettyPhase(phaseRaw = '') {
  const p = String(phaseRaw || '').toLowerCase();
  if (!p) return 'Panel';
  if (p.includes('playoffs')) return 'Playoffs';
  if (p.includes('playin') || p.includes('play-in') || p.includes('play_in')) return 'Play-In';
  return String(phaseRaw).toUpperCase();
}

/**
 * Zwraca query do policzenia liczby uczestników
 */
function getCountQueryForPhase(guildId, phaseRaw = '', stageFromPanel = null) {
  const p = String(phaseRaw || '').toLowerCase();

  let stageNorm = null;
  if (stageFromPanel) {
    stageNorm = String(stageFromPanel).toLowerCase();
  } else {
    const m = p.match(/stage[-_ ]?(1|2|3)|\b(1|2|3)\b/);
    if (m) stageNorm = `stage${m[1] || m[2]}`;
  }

  if (p.includes('swiss') || stageNorm) {
    return {
      any: {
        sql: `
          SELECT COUNT(DISTINCT user_id) AS c
          FROM swiss_predictions
          WHERE guild_id = ?
            AND stage = ?
        `,
        params: [guildId, stageNorm || 'stage1'],
      },
      stageNorm: stageNorm || 'stage1',
    };
  }

  if (p.includes('playoffs')) {
    return {
      any: {
        sql: `
          SELECT COUNT(DISTINCT user_id) AS c
          FROM playoffs_predictions
          WHERE guild_id = ?
        `,
        params: [guildId],
      },
      stageNorm: null,
    };
  }

  if (p.includes('playin') || p.includes('play-in') || p.includes('play_in')) {
    return {
      any: {
        sql: `
          SELECT COUNT(DISTINCT user_id) AS c
          FROM playin_predictions
          WHERE guild_id = ?
        `,
        params: [guildId],
      },
      stageNorm: null,
    };
  }

  return { any: null, stageNorm: null };
}

/* ====================================================== */

async function sendTrendsAfterDeadline(client, panelRow) {
  try {
    const channel = await client.channels.fetch(panelRow.channel_id).catch(() => null);
    if (!channel) return;

    const phaseLower = String(panelRow.phase || '').toLowerCase();

    const stats = await calculatePopularityForPanel({
      guildId: panelRow.guild_id,
      phase: phaseLower,
      stage: panelRow.stage || null,
      onlyActive: false,
    });

    let title = '📊 Trendy po deadline';
    let order = 'byConfidence';

    if (phaseLower.includes('swiss')) {
      title = `📊 Trendy po deadline • Swiss (${(panelRow.stage || '').toUpperCase()})`;
      order = 'byStageThenConfidence';
    } else if (phaseLower.includes('playoffs')) {
      title = '📊 Trendy po deadline • Playoffs';
    } else if (phaseLower.includes('playin')) {
      title = '📊 Trendy po deadline • Play-In';
    }

    const embed = buildPopularityEmbedGrouped(stats, {
      title,
      phaseGroup:
        phaseLower.includes('playoffs')
          ? 'playoffs'
          : phaseLower.includes('playin')
            ? 'playin'
            : 'swiss',
      topPerBucket: 30,
      order,
      showEmptyBuckets: false,
    });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.warn('Błąd przy wysyłaniu trendów:', err.message);
  }
}

/* ====================================================== */

async function closeExpiredPanelsForGuild(client, guildId) {
  guildId = String(guildId);
  if (_closeExpiredPanelsRunningByGuild.has(guildId)) return;
  _closeExpiredPanelsRunningByGuild.add(guildId);

  const pool = db.getPoolForGuild(guildId);

  try {
    const [rows] = await pool.query(
      pool,
      `
      SELECT id, message_id, channel_id, phase, stage, deadline
      FROM active_panels
      WHERE active = 1
        AND deadline IS NOT NULL
        AND NOW() >= deadline
      `,
      [],
      { guildId, scope: 'cron:closeExpiredPanels', label: 'select expired panels' }
    );

    if (!rows.length) return;

    for (const panel of rows) {
      try {
        const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
        if (!channel) continue;

        const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (!msg) continue;

        let count = 0;
        let stageNormUsed = null;

        const q = getCountQueryForPhase(guildId, panel.phase, panel.stage);
        if (q?.any?.sql) {
          const [[r]] = await pool.query(pool, q.any.sql, q.any.params);
          count = r?.c || 0;
          stageNormUsed = q.stageNorm;
        }

        const noun =
          count === 1 ? 'osoba' :
            count >= 2 && count <= 4 ? 'osoby' : 'osób';

        const phaseLabel =
          panel.phase.toLowerCase().includes('swiss')
            ? `Swiss (${(panel.stage || stageNormUsed || '').toUpperCase()})`
            : prettyPhase(panel.phase);

        const embed = new EmbedBuilder()
          .setColor('Red')
          .setTitle(`🔴 Etap ${phaseLabel}`)
          .setDescription(`Typowanie zostało zakończone. Wzięło udział **${count}** ${noun}.`)
          .setFooter({ text: `⏱ Typowanie zamknięte • ${count} zgłoszeń` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('pickem_closed')
            .setLabel('Typowanie zamknięte')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        await msg.edit({ embeds: [embed], components: [row] });

        await pool.query(
          pool,
          `UPDATE active_panels SET active = 0 WHERE id = ?`,
          [panel.id]
        );

        await sendTrendsAfterDeadline(client, panel);

      } catch (e) {
        console.warn(`[${guildId}] Błąd przy zamykaniu panelu`, e.message);
      }
    }
  } finally {
    _closeExpiredPanelsRunningByGuild.delete(guildId);
  }
}

/* ====================================================== */

async function closeExpiredPanels(client) {
  if (_closeExpiredPanelsRunningGlobal) return;
  _closeExpiredPanelsRunningGlobal = true;

  try {
    for (const guildId of getAllGuildIds()) {
      await closeExpiredPanelsForGuild(client, guildId);
    }
  } finally {
    _closeExpiredPanelsRunningGlobal = false;
  }
}

module.exports = { closeExpiredPanels };
