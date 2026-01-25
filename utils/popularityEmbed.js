// utils/buildPopularityEmbedGrouped.js
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { withGuild } = require('./guildContext');

/* =========================
   HELPERS
   ========================= */

function fmtPct(p) {
  const n = Number(p);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function normalizePhase(raw = '') {
  return String(raw).toLowerCase()
    .replace('_', '')
    .replace('-', '');
}

function colorForPhase(rawPhase) {
  const p = normalizePhase(rawPhase);
  return p.includes('swiss')      ? 0x1992ff
       : p.includes('playoffs')   ? 0xff3b3b
       : p.includes('double')     ? 0x9b59b6
       : p.includes('playin')     ? 0x2ecc71
       : 0xFFD166;
}

function chunkFieldValue(text, limit = 1024) {
  if (!text) return ['_brak danych_'];
  if (text.length <= limit) return [text];

  const lines = text.split('\n');
  const chunks = [];
  let buf = '';

  for (const line of lines) {
    const needed = (buf ? buf.length + 1 : 0) + line.length;
    if (needed > limit) {
      if (buf) chunks.push(buf);
      buf = line;
    } else {
      buf = buf ? buf + '\n' + line : line;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

/* =========================
   TEAMS SOURCE (SAFE)
   ========================= */

async function loadTeamsForGuild(source) {
  try {
    return await withGuild(source, async ({ guildId, pool }) => {
      const [rows] = await pool.query(
        `
        SELECT name
        FROM teams
        WHERE guild_id = ?
          AND active = 1
        ORDER BY name ASC
        `,
        [guildId]
      );
      return rows.map(r => r.name);
    });
  } catch {
    return loadTeamsFromFile();
  }
}

function loadTeamsFromFile() {
  try {
    const filePath = path.join(__dirname, '..', 'teams.json');
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : (parsed?.teams || []);
  } catch {
    return [];
  }
}

/* =========================
   GROUPED EMBED
   ========================= */

async function buildPopularityEmbedGrouped(stats, options = {}) {
  const {
    title = 'Trendy typowania',
    phase = 'Swiss',
    stage = null,
    rawPhase = 'swiss',
    topPerBucket = 30,
    order = ['3-0', '0-3', 'Awans'],
    showEmptyBuckets = false,
    guildId,
  } = options;

  const safeOrder = Array.isArray(order) ? order : ['3-0', '0-3', 'Awans'];
  const allTeams = await loadTeamsForGuild(guildId);

  const totalUsers = stats?.totalUsers ?? 0;
  const bucketsObj = stats?.buckets ?? {};

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      `Faza: **${phase}**` +
      (stage ? ` • Etap: **${stage}**` : '') +
      `\nUczestnicy: **${totalUsers}**`
    )
    .setColor(colorForPhase(rawPhase))
    .setTimestamp();

  const BUCKET_META = {
    '3-0': { title: '🥇 **Typ 3-0**' },
    '0-3': { title: '💀 **Typ 0-3**' },
    'Awans': { title: '🚀 **Typ awans**' },
  };

  const bucketKeys = Object.keys(bucketsObj);
  const sections = safeOrder.concat(
    bucketKeys.filter(k => !safeOrder.includes(k)).sort()
  );

  let anyData = false;

  for (const key of sections) {
    const original = Array.isArray(bucketsObj[key]) ? bucketsObj[key] : [];

    const filled = allTeams.length
      ? allTeams.map(team => {
          const found = original.find(r => r.team === team);
          return found || { team, count: 0, pct: 0 };
        })
      : original;

    const arr = filled
      .sort((a, b) => b.count - a.count || b.pct - a.pct || a.team.localeCompare(b.team))
      .slice(0, topPerBucket);

    if (!arr.length && !showEmptyBuckets) continue;
    anyData = true;

    const lines = arr.map(r => `${r.team} — ${fmtPct(r.pct)} % (${r.count})`);
    const parts = chunkFieldValue(lines.join('\n'));

    for (let i = 0; i < parts.length; i++) {
      embed.addFields({
        name: i === 0
          ? (BUCKET_META[key]?.title || `**${key}**`)
          : `${key} (cd.)`,
        value: parts[i],
      });
    }
  }

  if (!anyData) {
    embed.addFields({ name: 'Podsumowanie', value: '_brak danych_' });
  }

  embed.setFooter({ text: `Tryb grupowany • TOP ${topPerBucket} drużyn / sekcja` });
  return embed;
}

module.exports = {
  buildPopularityEmbedGrouped,
};
