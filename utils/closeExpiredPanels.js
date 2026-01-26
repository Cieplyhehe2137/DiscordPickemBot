const { getAllGuildIds } = require('./guildRegistry');
const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');

const { buildPopularityEmbedGrouped } = require('./popularityEmbed');
const { calculatePopularityForPanel } = require('./calcPopularityAll');
const { withGuild } = require('./guildContext');
const { disablePickemComponents } = require('../utils/disablePickemComponents');
const closeMatchPickPanels =
  require('../handlers/closeMatchPickPanels');


/* ======================================================
   🧯 ANTY-OVERLAP
   ====================================================== */
let _runningGlobal = false;
const _runningByGuild = new Set();

/* ====================================================== */

function prettyPhase(phaseRaw = '') {
  const p = String(phaseRaw || '').toLowerCase();
  if (!p) return 'Panel';
  if (p.includes('playoffs')) return 'Playoffs';
  if (p.includes('playin') || p.includes('play-in') || p.includes('play_in')) return 'Play-In';
  return phaseRaw.toString().toUpperCase();
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
      sql: `SELECT COUNT(DISTINCT user_id) AS c
            FROM swiss_predictions
            WHERE stage = ?`,
      params: [stageNorm || 'stage1'],
      stageNorm: stageNorm || 'stage1',
    };
  }

  if (p.includes('playoffs')) {
    return {
      sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playoffs_predictions`,
      params: [],
      stageNorm: null,
    };
  }

  if (p.includes('playin')) {
    return {
      sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playin_predictions`,
      params: [],
      stageNorm: null,
    };
  }

  return { sql: null, params: [], stageNorm: null };
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
  if (_runningByGuild.has(guildId)) return;
  _runningByGuild.add(guildId);

  try {
    await withGuild(guildId, async ({ pool }) => {
      const [rows] = await pool.query(
        `SELECT id, message_id, channel_id, phase, stage, deadline
         FROM active_panels
         WHERE active = 1
           AND deadline IS NOT NULL
           AND UTC_TIMESTAMP() >= deadline`
      );

      if (!rows.length) return;

      for (const panel of rows) {
        try {
          const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
          if (!channel) {
            await pool.query(`UPDATE active_panels SET active = 0 WHERE id = ?`, [panel.id]);
            continue;
          }

          const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
          if (!msg) {
            await pool.query(`UPDATE active_panels SET active = 0 WHERE id = ?`, [panel.id]);
            continue;
          }

          let count = 0;
          let stageNormUsed = null;

          const q = getCountQueryForPhase(panel.phase, panel.stage);
          stageNormUsed = q.stageNorm;

          if (q.sql) {
            const [[r]] = await pool.query(q.sql, q.params);
            count = r?.c || 0;
          }

          const noun =
            count === 1 ? 'osoba'
              : (count >= 2 && count <= 4 ? 'osoby' : 'osób');

          const phaseLabel =
            panel.phase.toLowerCase().includes('swiss')
              ? `Swiss (${(panel.stage || stageNormUsed || '').toUpperCase()})`
              : prettyPhase(panel.phase);

          const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle(`🔴 Etap ${phaseLabel}`)
            .setDescription(`Typowanie drużyn zostało zakończone. Nadal możesz typować wyniki meczów/map.`)
            .setFooter({ text: `⏱ Typowanie zamknięte • ${count} zgłoszeń` });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('pickem_closed')
              .setLabel('Typowanie zamknięte')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

          await msg.edit({ embeds: [embed] });
          await disablePickemComponents(msg);

          await pool.query(`UPDATE active_panels SET active = 0 WHERE id = ?`, [panel.id]);

          await sendTrendsAfterDeadline(client, panel);

        } catch (e) {
          console.warn(`[${guildId}] Błąd przy zamykaniu panelu`, e.message);
        }
      }
    });
  } finally {
    _runningByGuild.delete(guildId);
  }
}

async function closeExpiredPanels(client) {
  if (_runningGlobal) return;
  _runningGlobal = true;

  try {
    const guildIds = getAllGuildIds();

    // 🔴 watcher 1 – zamyka Pick’Em drużyn (per guild)
    for (const guildId of guildIds) {
      await closeExpiredPanelsForGuild(client, String(guildId));
    }

    // 🔵 watcher 2 – zamyka typowanie wyników (SAM iteruje po guildach)
    await closeMatchPickPanels(client);

  } finally {
    _runningGlobal = false;
  }
}

module.exports = { closeExpiredPanels };
