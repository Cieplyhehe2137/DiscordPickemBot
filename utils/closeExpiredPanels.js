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
  withGuild = require('./guildContext')?.withGuild;
} catch (_) {}

async function withGuildContext(guildId, fn) {
  if (withGuild) return withGuild(guildId, fn);
  return fn();
}

/**
 * Liczba uczestników dla fazy (per guild!)
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
      confirmed: {
        sql: `SELECT COUNT(DISTINCT user_id) AS c
              FROM swiss_predictions
              WHERE guild_id = ? AND active = 1 AND stage = ?`,
        params: [guildId, stageNorm || 'stage1'],
      },
      any: {
        sql: `SELECT COUNT(DISTINCT user_id) AS c
              FROM swiss_predictions
              WHERE guild_id = ? AND stage = ?`,
        params: [guildId, stageNorm || 'stage1'],
      },
      stageNorm: stageNorm || 'stage1',
    };
  }

  if (p.includes('playoffs')) {
    return {
      confirmed: {
        sql: `SELECT COUNT(DISTINCT user_id) AS c
              FROM playoffs_predictions
              WHERE guild_id = ? AND active = 1`,
        params: [guildId],
      },
      any: {
        sql: `SELECT COUNT(DISTINCT user_id) AS c
              FROM playoffs_predictions
              WHERE guild_id = ?`,
        params: [guildId],
      },
      stageNorm: null,
    };
  }

  if (p.includes('playin') || p.includes('play-in') || p.includes('play_in')) {
    return {
      confirmed: {
        sql: `SELECT COUNT(DISTINCT user_id) AS c
              FROM playin_predictions
              WHERE guild_id = ? AND active = 1`,
        params: [guildId],
      },
      any: {
        sql: `SELECT COUNT(DISTINCT user_id) AS c
              FROM playin_predictions
              WHERE guild_id = ?`,
        params: [guildId],
      },
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
      title = `📊 Trendy po Swiss (${panelRow.stage || 'stage'})`;
      order = 'byPickRate';
    }

    const embed = buildPopularityEmbedGrouped(stats, { title, order });
    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.warn('Błąd przy wysyłaniu trendów:', err.message);
  }
}

/* ======================================================
   🧯 ANTY-OVERLAP
   ====================================================== */

let _closeExpiredPanelsRunningGlobal = false;
const _closeExpiredPanelsRunningByGuild = new Set();

async function closeExpiredPanelsForGuild(client, guildId) {
  guildId = String(guildId);
  if (_closeExpiredPanelsRunningByGuild.has(guildId)) return;
  _closeExpiredPanelsRunningByGuild.add(guildId);

  const pool = db.getPoolForGuild(guildId);

  try {
    const [rows] = await safeQuery(
      pool,
      `SELECT id, message_id, channel_id, phase, stage, deadline, guild_id
       FROM active_panels
       WHERE active = 1
         AND deadline IS NOT NULL
         AND NOW() >= deadline
         AND guild_id = ?`,
      [guildId],
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
            `UPDATE active_panels
             SET active = 0, closed = 1, closed_at = NOW()
             WHERE id = ? AND guild_id = ?`,
            [panel.id, guildId],
            { guildId, scope: 'cron:closeExpiredPanels', label: 'deactivate missing channel' }
          );
          continue;
        }

        const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (!msg) {
          await safeQuery(
            pool,
            `UPDATE active_panels
             SET active = 0, closed = 1, closed_at = NOW()
             WHERE id = ? AND guild_id = ?`,
            [panel.id, guildId],
            { guildId, scope: 'cron:closeExpiredPanels', label: 'deactivate missing message' }
          );
          continue;
        }

        // policz uczestników (per guild)
        let count = 0;
        let stageNormUsed = null;

        try {
          const { any, stageNorm } = getCountQueryForPhase(panel.guild_id, panel.phase, panel.stage);
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
        } catch (_) {}

        const noun = count === 1 ? 'osoba' : (count >= 2 && count <= 4 ? 'osoby' : 'osób');

        const embed = (msg.embeds?.[0] ? EmbedBuilder.from(msg.embeds[0]) : new EmbedBuilder())
          .setColor(0x6B7280)
          .setFooter({ text: `⏱ Typowanie zamknięte • ${count} ${noun}` });

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
          `UPDATE active_panels
           SET active = 0, closed = 1, closed_at = NOW()
           WHERE id = ? AND guild_id = ?`,
          [panel.id, guildId],
          { guildId, scope: 'cron:closeExpiredPanels', label: 'close panel row' }
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
