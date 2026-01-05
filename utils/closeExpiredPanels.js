// utils/closeExpiredPanels.js
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

// opcjonalny kontekst (jeśli masz AsyncLocalStorage)
let runWithGuildId = null;
try {
  ({ runWithGuildId } = require('./guildContext'));
} catch (_) {
  // brak kontekstu — lecimy bez niego
}

async function withGuildContext(guildId, fn) {
  if (typeof runWithGuildId === 'function') {
    return runWithGuildId(String(guildId), fn);
  }
  return fn();
}

/* ======================================================
   🔒 BEZPIECZNE ZAPYTANIA SQL — ODPORNE NA CYBRANCEE (ETIMEDOUT etc.)
   ====================================================== */
const TRANSIENT_DB_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT',
  'ER_SERVER_SHUTDOWN',
  'ER_CON_COUNT_ERROR',
  'ER_TOO_MANY_USER_CONNECTIONS',
]);

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function safeQuery(pool, sql, params = [], opts = {}) {
  const guildId = opts.guildId ? String(opts.guildId) : undefined;
  const label = opts.label ? String(opts.label) : undefined;

  const maxAttempts = Math.max(1, Number(opts.maxAttempts || 3));
  const baseDelayMs = Math.max(200, Number(opts.baseDelayMs || 500));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      const code = err?.code;
      const transient = code && TRANSIENT_DB_CODES.has(code);

      if (!transient || attempt === maxAttempts) {
        throw err;
      }

      const jitter = Math.floor(Math.random() * 200);
      const delay = baseDelayMs * (2 ** (attempt - 1)) + jitter;

      const prefix = guildId ? `[${guildId}] ` : '';
      const q = label ? ` (${label})` : '';
      console.warn(
        `⚠️ ${prefix}MySQL chwilowo niedostępny${q}: ${code}. Retry za ${delay}ms (próba ${attempt}/${maxAttempts})`
      );

      await sleep(delay);
    }
  }
}

/* ======================================================
   🧯 ANTY-OVERLAP (setInterval potrafi odpalić drugi tick zanim skończy pierwszy)
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
              WHERE active = 1
                AND stage = ?`,
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
      any:       { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playoffs_predictions`, params: [] },
      stageNorm: null,
    };
  }

  if (p.includes('playin') || p.includes('play-in') || p.includes('play_in')) {
    return {
      confirmed: { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playin_predictions WHERE active = 1`, params: [] },
      any:       { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playin_predictions`, params: [] },
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
      phase: phaseLower,
      stage: (panelRow.stage || null),
      onlyActive: false,
    });

    let title = 'Trendy typowania';
    let phaseLabel = prettyPhase(panelRow.phase);
    let stageHuman = null;
    let order;

    if (phaseLower.includes('swiss') || panelRow.stage) {
      stageHuman = (panelRow.stage || '').toUpperCase();
      title = `📊 Trendy po deadline • Swiss (${stageHuman || 'STAGE'})`;
      order = 'byStageThenConfidence';
    } else if (phaseLower.includes('playoffs')) {
      title = '📊 Trendy po deadline • Playoffs';
      order = 'byConfidence';
    } else if (phaseLower.includes('playin') || phaseLower.includes('play-in') || phaseLower.includes('play_in')) {
      title = '📊 Trendy po deadline • Play-In';
      order = 'byConfidence';
    } else {
      title = `📊 Trendy po deadline • ${phaseLabel}`;
      order = 'byConfidence';
    }

    const embed = buildPopularityEmbedGrouped(stats, {
      title,
      phaseGroup:
        phaseLower.includes('playoffs') ? 'playoffs'
          : (phaseLower.includes('playin') || phaseLower.includes('play-in') || phaseLower.includes('play_in')) ? 'playin'
          : 'swiss',
      topPerBucket: 30,
      order,
      showEmptyBuckets: false,
    });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Błąd przy wysyłaniu trendów po zamknięciu panelu:', err);
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
      { guildId, label: 'select_expired_panels' }
    );

    if (!rows.length) return;

    for (const panel of rows) {
      try {
        const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
        if (!channel) {
          console.warn(`⚠️ [${guildId}] Brak kanału ${panel.channel_id} (panel ${panel.id}) – dezaktywuję w DB`);
          await safeQuery(pool, `UPDATE active_panels SET active = 0 WHERE id = ?`, [panel.id], { guildId, label: 'deactivate_missing_channel' }).catch(() => {});
          continue;
        }

        const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (!msg) {
          console.warn(`⚠️ [${guildId}] Brak wiadomości ${panel.message_id} (panel ${panel.id}) – dezaktywuję w DB`);
          await safeQuery(pool, `UPDATE active_panels SET active = 0 WHERE id = ?`, [panel.id], { guildId, label: 'deactivate_missing_message' }).catch(() => {});
          continue;
        }

        const embed = msg.embeds?.[0]
          ? EmbedBuilder.from(msg.embeds[0])
          : new EmbedBuilder();

        const phaseLabel = prettyPhase(panel.phase);

        // Liczenie osób
        let count = 0;
        let stageNormUsed = null;
        try {
          const { any, stageNorm } = getCountQueryForPhase(panel.phase, panel.stage);
          stageNormUsed = stageNorm;
          if (any.sql) {
            const [[r]] = await safeQuery(pool, any.sql, any.params, { guildId, label: 'count_participants' });
            count = r?.c || 0;
          }
        } catch (e) {
          console.warn(`⚠️ [${guildId}] Liczenie uczestników nie powiodło się:`, e.message);
        }

        const noun = count === 1 ? 'osoba' : (count >= 2 && count <= 4 ? 'osoby' : 'osób');
        const description = `Typowanie zostało zakończone. Wzięło udział **${count}** ${noun}.`;

        const phaseTitle =
          (String(panel.phase).toLowerCase().includes('swiss') || panel.stage)
            ? `Swiss (${(panel.stage || stageNormUsed || '').toUpperCase() || 'STAGE1'})`
            : phaseLabel;

        embed
          .setColor('Red')
          .setTitle(`🔴 Etap ${phaseTitle}`)
          .setDescription(description)
          .setFooter({ text: `⏱ Typowanie zamknięte • ${count} zgłoszeń` });

        const closedBtn = new ButtonBuilder()
          .setCustomId('pickem_closed')
          .setLabel('Typowanie zamknięte')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        const row = new ActionRowBuilder().addComponents(closedBtn);

        await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
        await safeQuery(pool, `UPDATE active_panels SET active = 0 WHERE id = ?`, [panel.id], { guildId, label: 'deactivate_panel' });

        console.log(`✅ [${guildId}] Zamknięto panel: ${phaseTitle} (msg ${panel.message_id}) — typowało ${count} osób`);

        await sendTrendsAfterDeadline(client, panel);

      } catch (e) {
        console.error(`❌ [${guildId}] Błąd przy zamykaniu jednego panelu:`, e);
      }
    }
  } catch (err) {
    console.error(`❌ [${guildId}] Błąd w closeExpiredPanels (zapytanie główne):`, err);
  } finally {
    _closeExpiredPanelsRunningByGuild.delete(guildId);
  }
}

async function closeExpiredPanels(client) {
  if (_closeExpiredPanelsRunningGlobal) return;
  _closeExpiredPanelsRunningGlobal = true;

  try {
    const guildIds = getAllGuildIds();
    if (!guildIds.length) return;

    for (const guildId of guildIds) {
      await withGuildContext(guildId, async () => {
        await closeExpiredPanelsForGuild(client, guildId);
      });
    }
  } finally {
    _closeExpiredPanelsRunningGlobal = false;
  }
}

module.exports = { closeExpiredPanels };
