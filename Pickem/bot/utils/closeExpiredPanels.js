// utils/closeExpiredPanels.js
const pool = require('../db');
const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');

const { buildPopularityEmbedGrouped } = require('./popularityEmbed');
const { calculatePopularityForPanel } = require('./calcPopularityAll');

/** Ładna etykieta fazy do tytułu embeda */
function prettyPhase(phaseRaw = '') {
  const p = String(phaseRaw || '').toLowerCase();

  // Swiss: wyłap także same "stage1/2/3"
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

/** Przygotuj zapytania do zliczenia uczestników; dla Swiss filtruj po konkretnym stage */
function getCountQueryForPhase(phaseRaw = '', stageFromPanel = null) {
  const p = String(phaseRaw || '').toLowerCase();

  // Preferuj stage z rekordu panelu (np. 'stage1'); w przeciwnym wypadku spróbuj wyciągnąć z tekstu.
  let stageNorm = null;
  if (stageFromPanel) {
    stageNorm = String(stageFromPanel).toLowerCase();
  } else {
    const m = p.match(/stage[-_ ]?(1|2|3)|\b(1|2|3)\b/);
    if (m) stageNorm = `stage${m[1] || m[2]}`;
  }

  if (p.includes('swiss') || stageNorm) {
    const confirmed = {
      sql: `SELECT COUNT(DISTINCT user_id) AS c
            FROM swiss_predictions
            WHERE ${stageNorm ? 'stage = ? AND ' : ''} active = 1`,
      params: stageNorm ? [stageNorm] : [],
    };
    const any = {
      sql: `SELECT COUNT(DISTINCT user_id) AS c
            FROM swiss_predictions
            WHERE ${stageNorm ? 'stage = ?' : '1=1'}`,
      params: stageNorm ? [stageNorm] : [],
    };
    return { confirmed, any, stageNorm };
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

/** Po zamknięciu panelu – policz i wyślij embed z trendami odpowiedni dla fazy */
async function sendTrendsAfterDeadline(client, panelRow) {
  try {
    const channel = await client.channels.fetch(panelRow.channel_id).catch(() => null);
    if (!channel) return;

    const phaseLower = String(panelRow.phase || '').toLowerCase();

    // Oblicz popularność dla tej fazy (bez filtra active, bo panel już zamknięty)
    const stats = await calculatePopularityForPanel({
      phase: phaseLower,
      stage: (panelRow.stage || null),
      onlyActive: false,
    });

    // Ustal nagłówek i kolejność sekcji zależnie od fazy
    let title = 'Trendy typowania';
    let phaseLabel = prettyPhase(panelRow.phase);
    let stageHuman = null;
    let order;

    if (phaseLower.includes('swiss') || panelRow.stage || /stage[ _-]?(1|2|3)|\b(1|2|3)\b/.test(phaseLower)) {
      const m2 = phaseLower.match(/stage[ _-]?(1|2|3)|\b(1|2|3)\b/);
      const st = panelRow.stage || (m2 ? `stage${m2[1] || m2[2]}` : null);
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

async function closeExpiredPanels(client) {
  try {
    const [rows] = await pool.query(
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
          console.warn(`⚠️ Brak kanału ${panel.channel_id} (panel ${panel.id})`);
          continue;
        }

        const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (!msg) {
          console.warn(`⚠️ Brak wiadomości ${panel.message_id} (panel ${panel.id})`);
          continue;
        }

        // Bierz istniejący embed, albo zbuduj nowy
        const embed = msg.embeds?.[0]
          ? EmbedBuilder.from(msg.embeds[0])
          : new EmbedBuilder();

        const phaseLabel = prettyPhase(panel.phase);

        // 🔢 Policz uczestników (dla konkretnego stage jeśli Swiss)
        let count = 0;
        let stageNormUsed = null;
        try {
          const { confirmed, any, stageNorm } = getCountQueryForPhase(panel.phase, panel.stage);
          stageNormUsed = stageNorm;
          if (confirmed.sql) {
            const [[r1]] = await pool.query(confirmed.sql, confirmed.params);
            count = r1?.c || 0;
            if (count === 0 && any.sql) {
              const [[r2]] = await pool.query(any.sql, any.params);
              count = r2?.c || 0;
            }
          }
        } catch (e) {
          console.warn('⚠️ Liczenie uczestników nie powiodło się:', e.message);
        }

        // Opis + stopka z liczbą zgłoszeń (PL odmiana)
        const noun = count === 1 ? 'osoba' : (count >= 2 && count <= 4 ? 'osoby' : 'osób');
        const description = `Typowanie zostało zakończone. Wzięło udział **${count}** ${noun}.`;

        // Tytuł z etapem Swiss jeśli dotyczy
        const phaseTitle =
          (String(panel.phase).toLowerCase().includes('swiss') || panel.stage)
            ? `Swiss (${(panel.stage || stageNormUsed || '').toUpperCase() || 'STAGE1'})`
            : phaseLabel;

        embed
          .setColor('Red')
          .setTitle(`🔴 Etap ${phaseTitle}`)
          .setDescription(description)
          .setFooter({ text: `⏱ Typowanie zamknięte • ${count} zgłoszeń` });

        // Zamiana przycisku na wyszarzony "Typowanie zamknięte"
        const closedBtn = new ButtonBuilder()
          .setCustomId('pickem_closed')
          .setLabel('Typowanie zamknięte')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        const row = new ActionRowBuilder().addComponents(closedBtn);

        await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
        await pool.query(`UPDATE active_panels SET active = 0 WHERE id = ?`, [panel.id]);

        console.log(`✅ Zamknięto panel: ${phaseTitle} (msg ${panel.message_id}) — typowało ${count} osób`);

        // ➕ Wyślij „Trendy typowania” dla tej fazy/stage
        await sendTrendsAfterDeadline(client, panel);

      } catch (e) {
        console.error('❌ Błąd przy zamykaniu jednego panelu:', e);
      }
    }
  } catch (err) {
    console.error('❌ Błąd w closeExpiredPanels (zapytanie):', err);
  }
}

module.exports = { closeExpiredPanels };
