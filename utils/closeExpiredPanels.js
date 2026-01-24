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

// ALS / guild context
let withGuild = null;
try {
  ({ withGuild } = require('./guildContext'));
} catch (_) { }

async function withGuildContext(guildId, fn) {
  if (typeof withGuild === 'function') {
    return withGuild(String(guildId), fn);
  }
  return fn();
}

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
  return (phaseRaw || '').toString().toUpperCase();
}

function getCountQueryForPhase(phaseRaw = '', stageFromPanel = null) {
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
      confirmed: {
        sql: `SELECT COUNT(DISTINCT user_id) AS c
              FROM swiss_predictions
              WHERE active = 1 AND stage = ?`,
        params: [stageNorm || 'stage1'],
      },
      any: {
        sql: `SELECT COUNT(DISTINCT user_id) AS c
              FROM swiss_predictions
              WHERE stage = ?`,
        params: [stageNorm || 'stage1'],
      },
      stageNorm: stageNorm || 'stage1',
    };
  }

  if (p.includes('playoffs')) {
    return {
      confirmed: { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playoffs_predictions WHERE active = 1`, params: [] },
      any: { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playoffs_predictions`, params: [] },
      stageNorm: null,
    };
  }

  if (p.includes('playin') || p.includes('play-in') || p.includes('play_in')) {
    return {
      confirmed: { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playin_predictions WHERE active = 1`, params: [] },
      any: { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playin_predictions`, params: [] },
      stageNorm: null,
    };
  }

  return { confirmed: { sql: '', params: [] }, any: { sql: '', params: [] }, stageNorm: null };
}

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
      title = `📊 Trendy po deadline • Swiss (${(panelRow.stage || '').toUpperCase() || 'STAGE'})`;
      order = 'byStageThenConfidence';
    } else if (phaseLower.includes('playoffs')) {
      title = '📊 Trendy po deadline • Playoffs';
    } else if (phaseLower.includes('playin')) {
      title = '📊 Trendy po deadline • Play-In';
    }

    const embed = buildPopularityEmbedGrouped(stats, {
      title,
      phaseGroup:
        phaseLower.includes('playoffs') ? 'playoffs'
          : phaseLower.includes('playin') ? 'playin'
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

async function closeExpiredPanelsForGuild(client, guildId) {
  guildId = String(guildId);
  if (_closeExpiredPanelsRunningByGuild.has(guildId)) return;
  _closeExpiredPanelsRunningByGuild.add(guildId);

  const pool = db.getPoolForGuild(guildId);

  try {
    const [rows] = await safeQuery(
      pool,
      `SELECT id, message_id, channel_id, phase, stage, deadline
       FROM active_panels
       WHERE active = 1
         AND deadline IS NOT NULL
         AND NOW() >= deadline`,
      [],
      {
        guildId,
        scope: 'cron:closeExpiredPanels',
        label: 'select expired panels',
      }
    );

    if (!rows.length) return;

    for (const panel of rows) {
      try {
        const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
        if (!channel) {
          await safeQuery(
            pool,
            `UPDATE active_panels SET active = 0 WHERE id = ?`,
            [panel.id],
            { guildId, scope: 'cron:closeExpiredPanels', label: 'deactivate missing channel' }
          );
          continue;
        }

        const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (!msg) {
          await safeQuery(
            pool,
            `UPDATE active_panels SET active = 0 WHERE id = ?`,
            [panel.id],
            { guildId, scope: 'cron:closeExpiredPanels', label: 'deactivate missing message' }
          );
          continue;
        }

        // liczenie uczestników
        let count = 0;
        let stageNormUsed = null;
        try {
          const { any, stageNorm } = getCountQueryForPhase(panel.phase, panel.stage);
          stageNormUsed = stageNorm;
          if (any.sql) {
            const [[r]] = await safeQuery(
              pool,
              any.sql,
              any.params,
              { guildId, scope: 'cron:closeExpiredPanels', label: 'count participants' }
            );
            count = r?.c || 0;
          }
        } catch (_) { }

        const noun = count === 1 ? 'osoba' : (count >= 2 && count <= 4 ? 'osoby' : 'osób');
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
        await safeQuery(
          pool,
          `UPDATE active_panels SET active = 0 WHERE id = ?`,
          [panel.id],
          { guildId, scope: 'cron:closeExpiredPanels', label: 'deactivate panel' }
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

async function closeExpiredPanels(client) {
  if (_closeExpiredPanelsRunningGlobal) return;
  _closeExpiredPanelsRunningGlobal = true;

  try {
    const guildIds = getAllGuildIds();
    for (const guildId of guildIds) {
      await withGuildContext(guildId, () => closeExpiredPanelsForGuild(client, guildId));
    }
  } finally {
    _closeExpiredPanelsRunningGlobal = false;
  }
}

module.exports = { closeExpiredPanels };
