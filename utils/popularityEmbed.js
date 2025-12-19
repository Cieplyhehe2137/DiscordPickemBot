// utils/popularityEmbeds.js
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

function fmtPct(p) {
  const n = Number(p);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function colorForPhase(rawPhase) {
  const p = (rawPhase || '').toLowerCase();
  return p === 'swiss'      ? 0x1992ff
       : p === 'playoffs'   ? 0xff3b3b
       : p === 'doubleelim' ? 0x9b59b6
       : p === 'playin'     ? 0x2ecc71
       : 0xFFD166;
}

function chunkFieldValue(text, limit = 1024) {
  if (!text) return ['_brak danych_'];
  if (text.length <= limit) return [text];

  const lines = text.split('\n');
  const chunks = [];
  let buf = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const needed = (buf ? buf.length + 1 : 0) + line.length;
    if (needed > limit) {
      if (buf) chunks.push(buf);
      buf = line;
    } else {
      buf = buf ? (buf + '\n' + line) : line;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : ['_brak danych_'];
}

/** 🔄 Dynamiczne wczytywanie drużyn z teams.json */
function loadAllTeamsFromFile() {
  try {
    const filePath = path.join(__dirname, '..', 'teams.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    // u Ciebie teams.json to tablica stringów ['FaZe', 'G2', ...]
    if (Array.isArray(parsed)) return parsed;

    // awaryjnie jeśli kiedyś zrobisz { teams: [...] }
    if (Array.isArray(parsed.teams)) return parsed.teams;

    return [];
  } catch (err) {
    console.error('[popularityEmbeds] Nie udało się wczytać teams.json:', err.message);
    return [];
  }
}

/** === WERSJA GRUPOWANA === */
function buildPopularityEmbedGrouped(stats, options) {
  options = options || {};
  const title         = options.title || 'Trendy typowania';
  const phase         = options.phase || 'Swiss';
  const stage         = typeof options.stage !== 'undefined' ? options.stage : null;
  const rawPhase      = options.rawPhase || 'swiss';
  const topPerBucket  = typeof options.topPerBucket === 'number' ? options.topPerBucket : 30;
  const order         = options.order || ['3-0', '0-3', 'Awans'];
  const showEmpty     = !!options.showEmptyBuckets;

  // 🔥 nowość: lista wszystkich drużyn – albo z options, albo z teams.json
  const allTeams = Array.isArray(options.allTeams) && options.allTeams.length
    ? options.allTeams
    : loadAllTeamsFromFile();

  const totalUsers = (stats && typeof stats.totalUsers === 'number') ? stats.totalUsers : 0;
  const bucketsObj = (stats && stats.buckets) ? stats.buckets : {};

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      'Faza: **' + phase + '**' + (stage ? (' • Etap: **' + stage + '**') : '') +
      '\nUczestnicy: **' + totalUsers + '**'
    )
    .setColor(colorForPhase(rawPhase))
    .setTimestamp();

  const BUCKET_META = {
    '3-0':   { title: '🥇 **Typ 3-0**' },
    '0-3':   { title: '💀 **Typ 0-3**' },
    'Awans': { title: '🚀 **Typ awans**' },
  };

  const bucketKeys = Object.keys(bucketsObj);
  const extra = bucketKeys
    .filter((k) => order.indexOf(k) === -1)
    .sort((a, b) => a.localeCompare(b));
  const sections = order.concat(extra);

  let anyData = false;

  for (let s = 0; s < sections.length; s++) {
    const key = sections[s];

    // 👇 startujemy od istniejących wyników z calcPopularityAll
    const originalArr = Array.isArray(bucketsObj[key]) ? bucketsObj[key].slice() : [];

    // 🔧 dorzuć brakujące drużyny z 0% (jeśli mamy listę allTeams)
    let arr;
    if (allTeams && allTeams.length) {
      const seen = new Set(originalArr.map((r) => r.team));

      const filled = originalArr.slice();
      for (const team of allTeams) {
        if (!seen.has(team)) {
          filled.push({
            team,
            count: 0,
            pct: 0,
          });
        }
      }

      // posortuj po count, pct, nazwa – żeby ładnie wyglądało
      filled.sort((a, b) =>
        b.count - a.count ||
        b.pct - a.pct ||
        a.team.localeCompare(b.team)
      );

      // przytnij do topPerBucket
      arr = filled.slice(0, topPerBucket);
    } else {
      // fallback – zachowanie jak wcześniej
      arr = originalArr.slice(0, topPerBucket);
    }

    if (!arr.length && !showEmpty) continue;
    if (arr.length) anyData = true;

    const lines = arr.map((r) => {
      return r.team + ' — ' + fmtPct(r.pct) + ' % (' + r.count + ')';
    });

    const header = (BUCKET_META[key] && BUCKET_META[key].title)
      ? BUCKET_META[key].title
      : ('**' + key + '**');

    const value = lines.length ? lines.join('\n') : '_brak danych_';

    const parts = chunkFieldValue(value, 1024);
    for (let i = 0; i < parts.length; i++) {
      embed.addFields({
        name: i === 0 ? header : (header + ' (cd.)'),
        value: parts[i],
      });
    }
  }

  if (!anyData) {
    embed.addFields({ name: 'Podsumowanie', value: '_brak danych_' });
  }

  embed.setFooter({ text: 'Tryb grupowany • TOP ' + topPerBucket + ' drużyn / sekcja' });
  return embed;
}

/** (Twoja spłaszczona wersja – zostawiam w spokoju) */
function flattenStats(stats, opts) {
  opts = opts || {};
  const minCount = typeof opts.minCount === 'number' ? opts.minCount : 1;
  const showZero = !!opts.showZero;

  const bucketsObj = (stats && stats.buckets) ? stats.buckets : {};
  const map = new Map();

  function label(name) { return name === 'Awans' ? 'Awans' : name; }

  Object.keys(bucketsObj).forEach(function (bucketName) {
    const arr = bucketsObj[bucketName] || [];
    for (let i = 0; i < arr.length; i++) {
      const r = arr[i];
      if (!map.has(r.team)) map.set(r.team, { counts: {}, totalCount: 0, maxPct: 0 });
      const t = map.get(r.team);
      t.counts[bucketName] = { pct: r.pct, count: r.count, label: label(bucketName) };
      t.totalCount += r.count;
      t.maxPct = Math.max(t.maxPct, Number(r.pct) || 0);
    }
  });

  const rows = [];
  const bucketOrder = Object.keys(bucketsObj);

  map.forEach(function (v, team) {
    if (!showZero && v.totalCount < minCount) return;
    const parts = [];
    for (let i = 0; i < bucketOrder.length; i++) {
      const name = bucketOrder[i];
      const x = v.counts[name];
      if (!x) continue;
      parts.push(x.label + ': ' + fmtPct(x.pct) + '% (' + x.count + ')');
    }
    if (!parts.length) return;
    rows.push({ team: team, line: parts.join(', '), score: v.totalCount, secondary: v.maxPct });
  });

  rows.sort(function (a, b) {
    return (b.score - a.score) || (b.secondary - a.secondary) || a.team.localeCompare(b.team);
  });
  return rows;
}

function buildPopularityEmbedFlat(stats, options) {
  options = options || {};
  const title     = options.title || 'Trendy typowania';
  const phase     = options.phase || 'Swiss';
  const stage     = typeof options.stage !== 'undefined' ? options.stage : null;
  const rawPhase  = options.rawPhase || 'swiss';
  const topTeams  = typeof options.topTeams === 'number' ? options.topTeams : 30;
  const minCount  = typeof options.minCount === 'number' ? options.minCount : 1;
  const showZero  = !!options.showZero;

  const totalUsers = (stats && typeof stats.totalUsers === 'number') ? stats.totalUsers : 0;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      'Faza: **' + phase + '**' + (stage ? (' • Etap: **' + stage + '**') : '') +
      '\nUczestnicy: **' + totalUsers + '**'
    )
    .setColor(colorForPhase(rawPhase))
    .setTimestamp();

  const rows = flattenStats(stats, { minCount: minCount, showZero: showZero }).slice(0, topTeams);

  if (!rows.length) {
    embed.addFields({ name: 'Podsumowanie', value: '_brak danych_' });
  } else {
    const text = rows.map(function (r, i) {
      return '**' + (i + 1) + '. ' + r.team + '** — ' + r.line;
    }).join('\n');

    const parts = chunkFieldValue(text, 1024);
    for (let i = 0; i < parts.length; i++) {
      embed.addFields({ name: i === 0 ? 'Podsumowanie' : 'Podsumowanie (cd.)', value: parts[i] });
    }
  }

  embed.setFooter({ text: 'Tryb spłaszczony • TOP ' + topTeams + ' drużyn' });
  return embed;
}

module.exports = {
  buildPopularityEmbedGrouped,
  buildPopularityEmbedFlat,
};
