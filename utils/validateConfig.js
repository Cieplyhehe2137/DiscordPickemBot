// utils/validateGuilds.js
const { DateTime } = require('luxon');
const logger = require('./logger');
const { withGuild } = require('./guildContext');
const {
  getAllGuildIds,
  getGuildConfig,
} = require('./guildRegistry');

/* ================= CONFIG ================= */

const REQUIRED_GUILD_CONFIG = [
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'EXPORT_PANEL_CHANNEL_ID',
  'ARCHIVE_CHANNEL_ID',
];

const REQUIRED_TABLES = [
  'teams',
  'tournament_state',
  'tournament_audit_log',
  'swiss_predictions',
  'swiss_results',
  'swiss_scores',
  'playoffs_predictions',
  'playoffs_results',
  'playoffs_scores',
  'doubleelim_predictions',
  'doubleelim_results',
  'doubleelim_scores',
  'playin_predictions',
  'playin_results',
  'playin_scores',
  'matches',
  'match_predictions',
  'match_results',
  'match_points',
  'active_panels',
];

const REQUIRED_COLUMNS = {
  teams: ['id', 'guild_id', 'name', 'active', 'sort_order'],
  tournament_state: ['id', 'phase', 'is_open'],
  tournament_audit_log: ['guild_id', 'actor_discord_id', 'action'],
  swiss_predictions: ['user_id', 'stage'],
  swiss_results: ['stage'],
  swiss_scores: ['user_id', 'stage', 'points'],
  playoffs_predictions: ['user_id'],
  playoffs_results: ['correct_winner'],
  playoffs_scores: ['user_id', 'points'],
  doubleelim_predictions: ['user_id'],
  doubleelim_results: ['upper_final_a'],
  doubleelim_scores: ['user_id', 'points'],
  playin_predictions: ['user_id'],
  playin_results: ['correct_teams'],
  playin_scores: ['user_id', 'points'],
  matches: ['id', 'guild_id'],
  match_predictions: ['match_id', 'user_id'],
  match_results: ['match_id'],
  match_points: ['match_id', 'user_id'],
  active_panels: ['phase', 'message_id', 'active'],
};

/* ================= HELPERS ================= */

async function tableExists(pool, table) {
  const [rows] = await pool.query('SHOW TABLES LIKE ?', [table]);
  return rows.length > 0;
}

async function getColumns(pool, table) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
  return rows.map(r => r.Field);
}

async function checkChannel(client, guildId, channelId) {
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch) return { ok: false, reason: 'not found' };
    if (ch.guildId && String(ch.guildId) !== String(guildId)) {
      return { ok: false, reason: 'belongs to another guild' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/* ================= SINGLE GUILD ================= */

async function validateGuild(client, source) {
  return withGuild(source, async ({ guildId, pool }) => {
    const ok = [];
    const warn = [];
    const fail = [];

    const cfg = getGuildConfig(guildId);
    if (!cfg) {
      fail.push('Brak configu guilda');
      return { guildId, ok, warn, fail, summary: '❌ brak configu' };
    }

    for (const k of REQUIRED_GUILD_CONFIG) {
      if (!cfg[k]) fail.push(`Config: brak ${k}`);
    }
    if (!fail.length) ok.push('Config guilda: OK');

    for (const key of ['EXPORT_PANEL_CHANNEL_ID', 'ARCHIVE_CHANNEL_ID']) {
      const res = await checkChannel(client, guildId, cfg[key]);
      res.ok ? ok.push(`Kanał ${key}: OK`) : fail.push(`Kanał ${key}: ${res.reason}`);
    }

    for (const table of REQUIRED_TABLES) {
      if (!(await tableExists(pool, table))) {
        fail.push(`DB: brak tabeli ${table}`);
        continue;
      }

      const must = REQUIRED_COLUMNS[table];
      if (!must) continue;

      const cols = await getColumns(pool, table);
      const missing = must.filter(c => !cols.includes(c));
      missing.length
        ? fail.push(`DB: ${table} brak kolumn: ${missing.join(', ')}`)
        : ok.push(`DB: ${table} OK`);
    }

    try {
      const [rows] = await pool.query(
        `SELECT phase, deadline FROM active_panels WHERE active = 1`
      );

      const seen = {};
      for (const r of rows) {
        seen[r.phase] = (seen[r.phase] || 0) + 1;
        if (!r.deadline) warn.push(`active_panels ${r.phase}: brak deadline`);
        else if (DateTime.fromJSDate(r.deadline) < DateTime.now())
          warn.push(`active_panels ${r.phase}: deadline w przeszłości`);
      }

      for (const [phase, n] of Object.entries(seen)) {
        if (n > 1) fail.push(`active_panels: ${phase} ma ${n} aktywne panele`);
      }
    } catch (e) {
      warn.push(`active_panels: błąd (${e.message})`);
    }

    const summary =
      fail.length
        ? `❌ ${fail.length} błędów / ⚠️ ${warn.length} ostrzeżeń / ✅ ${ok.length} OK`
        : warn.length
          ? `⚠️ ${warn.length} ostrzeżeń / ✅ ${ok.length} OK`
          : `✅ Wszystko OK (${ok.length})`;

    return { guildId, ok, warn, fail, summary };
  });
}

/* ================= PUBLIC ================= */

module.exports = async function validateAllGuilds(client) {
  const reports = [];

  for (const guildId of getAllGuildIds()) {
    try {
      reports.push(await validateGuild(client, guildId));
    } catch (e) {
      logger.error('validator', 'Guild validation failed', {
        guildId,
        message: e.message,
      });
      reports.push({
        guildId,
        ok: [],
        warn: [],
        fail: [`Validator crash: ${e.message}`],
        summary: '❌ validator crash',
      });
    }
  }

  return reports;
};
