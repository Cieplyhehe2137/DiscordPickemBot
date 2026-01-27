const { pool } = require('../db');
const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');

const { buildPopularityEmbedGrouped } = require('./popularityEmbed');
const { calculatePopularityForPanel } = require('./calcPopularityAll');
const { disablePickemComponents } = require('../utils/disablePickemComponents');

let _running = false;

/* ====================================================== */

function prettyPhase(phaseRaw = '') {
  const p = String(phaseRaw || '').toLowerCase();
  if (!p) return 'Panel';
  if (p.includes('playoffs')) return 'Playoffs';
  if (p.includes('playin')) return 'Play-In';
  return String(phaseRaw).toUpperCase();
}

function getCountQueryForPhase(phaseRaw = '', stage = null) {
  const p = String(phaseRaw || '').toLowerCase();

  if (p.includes('swiss')) {
    return {
      sql: `
        SELECT COUNT(DISTINCT user_id) AS c
        FROM swiss_predictions
        WHERE stage = ?
      `,
      params: [stage || 'stage1'],
    };
  }

  if (p.includes('playoffs')) {
    return {
      sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playoffs_predictions`,
      params: [],
    };
  }

  if (p.includes('playin')) {
    return {
      sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playin_predictions`,
      params: [],
    };
  }

  return null;
}

/* ====================================================== */

async function closeExpiredPanels(client) {
  if (_running) return;
  _running = true;

  try {
    const [rows] = await pool.query(`
      SELECT *
      FROM active_panels
      WHERE active = 1
        AND deadline IS NOT NULL
        AND UTC_TIMESTAMP() >= deadline
    `);

    if (!rows.length) return;

    for (const panel of rows) {
      try {
        const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
        if (!channel) continue;

        const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (!msg) continue;

        const q = getCountQueryForPhase(panel.phase, panel.stage);
        let count = 0;

        if (q) {
          const [[r]] = await pool.query(q.sql, q.params);
          count = r?.c || 0;
        }

        const noun =
          count === 1 ? 'osoba'
            : (count >= 2 && count <= 4 ? 'osoby' : 'osób');

        const phaseLabel =
          panel.phase.includes('swiss')
            ? `Swiss (${String(panel.stage || '').toUpperCase()})`
            : prettyPhase(panel.phase);

        const embed = new EmbedBuilder()
          .setColor('Red')
          .setTitle(`🔴 Etap ${phaseLabel}`)
          .setDescription(
            `Typowanie drużyn zostało zakończone. Nadal możesz typować wyniki meczów/map.`
          )
          .setFooter({ text: `⏱ Typowanie zamknięte • ${count} ${noun}` });

        await msg.edit({ embeds: [embed] });
        await disablePickemComponents(msg);

        await pool.query(
          `UPDATE active_panels SET active = 0 WHERE id = ?`,
          [panel.id]
        );

        await sendTrendsAfterDeadline(client, panel);

      } catch (e) {
        console.warn('[PANEL WATCHER] error:', e.message);
      }
    }
  } finally {
    _running = false;
  }
}

module.exports = { closeExpiredPanels };
