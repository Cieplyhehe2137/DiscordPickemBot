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
   🔒 BEZPIECZNE ZAPYTANIA SQL — ODPORNE NA CYBRANCEE
   ====================================================== */
async function safeQuery(pool, sql, params = [], attempt = 1) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    const transient =
      err.code === 'ER_SERVER_SHUTDOWN' ||
      err.code === 'PROTOCOL_CONNECTION_LOST' ||
      err.code === 'ECONNREFUSED';

    if (transient && attempt <= 3) {
      console.warn(
        `⚠️  MySQL niedostępny (próba ${attempt}/3): ${err.code}. Retrying za 2s...`
      );
      await new Promise((res) => setTimeout(res, 2000));
      return safeQuery(pool, sql, params, attempt + 1);
    }

    throw err;
  }
}

/* ====================================================== */

function prettyPhase(phaseRaw = '') {
  const p = String(phaseRaw || '').toLowerCase();

  if (p.includes('swiss') || /\bstage[-_ ]?(1|2|3)\b|\b(1|2|3)\b/.test(p)) {
    const m = p.match(/stage[-_ ]?(1|2|3)|\b(1|2|3)\b/);
    const n = (m && (m[1] || m[2])) ? (m[1] || m[2]) : '';
    return n ? `Swiss (STAGE${n})` : 'Swiss';
  }
  if (p.includes('playoffs')) return 'Playoffs';
  if (p.includes('double')) return 'Double Elimination';
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
              WHERE ${stageNorm ? 'stage = ? AND ' : ''} active = 1`,
        params: stageNorm ? [stageNorm] : [],
      },
      any: {
        sql: `SELECT COUNT(DISTINCT user_id) AS c
              FROM swiss_predictions
              WHERE ${stageNorm ? 'stage = ?' : '1=1'}`,
        params: stageNorm ? [stageNorm] : [],
      },
      stageNorm,
    };
  }

  if (p.includes('playoffs')) {
    return {
      confirmed: { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playoffs_predictions WHERE active = 1`, params: [] },
      any:       { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM playoffs_predictions`, params: [] },
      stageNorm: null,
    };
  }

  if (p.includes('double')) {
    return {
      confirmed: { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM doubleelim_predictions WHERE active = 1`, params: [] },
      any:       { sql: `SELECT COUNT(DISTINCT user_id) AS c FROM doubleelim_predictions`, params: [] },
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
      const st = panelRow.stage;
      stageHuman =
        st === 'stage1' ? 'Swiss 1' :
        st === 'stage2' ? 'Swiss 2' :
        st === 'stage3' ? 'Swiss 3' : 'Swiss';
      title = `Trendy typowania – ${stageHuman}`;
      order = ['3-0', '0-3', 'Awans'];
    } else if (phaseLower.includes('playoffs')) {
      title = 'Trendy typowania – Playoffs';
      order = ['Półfinaliści', 'Finaliści', 'Zwycięzca', '3. miejsce'];
    } else if (phaseLower.includes('double')) {
      title = 'Trendy typowania – Double Elimination';
      order = ['Upper Final – Grupa A', 'Lower Final – Grupa A', 'Upper Final – Grupa B', 'Lower Final – Grupa B'];
    } else if (phaseLower.includes('playin') || phaseLower.includes('play-in') || phaseLower.includes('play_in')) {
      title = 'Trendy typowania – Play-In';
      order = ['Awans'];
    } else {
      order = Object.keys(stats.buckets || {});
    }

    const embed = buildPopularityEmbedGrouped(stats, {
      title,
      phase: phaseLabel,
      stage: stageHuman,
      rawPhase: phaseLower.includes('double') ? 'doubleelim'
             : phaseLower.includes('playin') ? 'playin'
             : phaseLower.includes('playoffs') ? 'playoffs'
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
  const pool = db.getPoolForGuild(guildId);

  try {
    const [rows] = await safeQuery(
      pool,
      `SELECT id, message_id, channel_id, phase, stage, deadline
         FROM active_panels
        WHERE active = 1
          AND deadline IS NOT NULL
          AND NOW() >= deadline`
    );

    if (!rows.length) return;

    for (const panel of rows) {
      try {
        const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
        if (!channel) {
          console.warn(`⚠️ [${guildId}] Brak kanału ${panel.channel_id} (panel ${panel.id})`);
          continue;
        }

        const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (!msg) {
          console.warn(`⚠️ [${guildId}] Brak wiadomości ${panel.message_id} (panel ${panel.id})`);
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
            const [[r]] = await safeQuery(pool, any.sql, any.params);
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
        await safeQuery(pool, `UPDATE active_panels SET active = 0 WHERE id = ?`, [panel.id]);

        console.log(`✅ [${guildId}] Zamknięto panel: ${phaseTitle} (msg ${panel.message_id}) — typowało ${count} osób`);

        await sendTrendsAfterDeadline(client, panel);

      } catch (e) {
        console.error(`❌ [${guildId}] Błąd przy zamykaniu jednego panelu:`, e);
      }
    }
  } catch (err) {
    console.error(`❌ [${guildId}] Błąd w closeExpiredPanels (zapytanie główne):`, err);
  }
}

async function closeExpiredPanels(client) {
  const guildIds = getAllGuildIds();
  if (!guildIds.length) return;

  for (const guildId of guildIds) {
    await withGuildContext(guildId, async () => {
      await closeExpiredPanelsForGuild(client, guildId);
    });
  }
}

module.exports = { closeExpiredPanels };
