// utils/validateGuilds.js
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const db = require('../db');
const logger = require('./logger');
const {
  getAllGuildIds,
  getGuildConfig,
} = require('./guildRegistry');

/* ======================================================
   KONFIG
   ====================================================== */

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

  swiss_predictions: ['user_id', 'stage', 'pick_3_0', 'pick_0_3', 'advancing'],
  swiss_results: ['stage', 'correct_3_0', 'correct_0_3', 'correct_advancing'],
  swiss_scores: ['user_id', 'stage', 'points'],

  playoffs_predictions: ['user_id', 'semifinalists', 'finalists', 'winner'],
  playoffs_results: ['correct_semifinalists', 'correct_finalists', 'correct_winner'],
  playoffs_scores: ['user_id', 'points'],

  doubleelim_predictions: ['user_id', 'upper_final_a', 'lower_final_a'],
  doubleelim_results: ['upper_final_a', 'lower_final_a'],
  doubleelim_scores: ['user_id', 'points'],

  playin_predictions: ['user_id', 'teams'],
  playin_results: ['correct_teams'],
  playin_scores: ['user_id', 'points'],

  matches: ['id', 'guild_id', 'team_a', 'team_b', 'best_of'],
  match_predictions: ['match_id', 'user_id', 'pred_a', 'pred_b'],
  match_results: ['match_id', 'res_a', 'res_b'],
  match_points: ['match_id', 'user_id', 'points'],

  active_panels: ['phase', 'message_id', 'deadline', 'active'],
};

/* ======================================================
   HELPERS
   ====================================================== */

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
    return { ok: true, type: ch.type };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/* ======================================================
   WALIDACJA JEDNEGO GUILDA
   ====================================================== */

async function validateGuild(client, guildId) {
  const ok = [];
  const warn = [];
  const fail = [];

  const cfg = getGuildConfig(guildId);
  if (!cfg) {
    fail.push('Brak configu guilda');
    return { guildId, ok, warn, fail, summary: '❌ brak configu' };
  }

  // --- config
  for (const k of REQUIRED_GUILD_CONFIG) {
    if (!cfg[k] || !String(cfg[k]).trim()) {
      fail.push(`Config: brak ${k}`);
    }
  }
  if (!fail.length) ok.push('Config guilda: OK');

  // --- channels
  for (const key of ['EXPORT_PANEL_CHANNEL_ID', 'ARCHIVE_CHANNEL_ID']) {
    const res = await checkChannel(client, guildId, cfg[key]);
    if (res.ok) ok.push(`Kanał ${key}: OK`);
    else fail.push(`Kanał ${key}: ${res.reason}`);
  }

  // --- DB
  const pool = db.getPoolForGuild(guildId);

  for (const table of REQUIRED_TABLES) {
    const exists = await tableExists(pool, table);
    if (!exists) {
      fail.push(`DB: brak tabeli ${table}`);
      continue;
    }

    ok.push(`DB: tabela ${table} istnieje`);

    const mustCols = REQUIRED_COLUMNS[table];
    if (!mustCols) continue;

    const cols = await getColumns(pool, table);
    const missing = mustCols.filter(c => !cols.includes(c));
    if (missing.length) {
      fail.push(`DB: ${table} brak kolumn: ${missing.join(', ')}`);
    } else {
      ok.push(`DB: ${table} kolumny OK`);
    }
  }

  // --- active_panels sanity
  try {
    const [rows] = await pool.query(
      `SELECT phase, deadline FROM active_panels WHERE active = 1`
    );

    const byPhase = {};
    for (const r of rows) {
      byPhase[r.phase] = (byPhase[r.phase] || 0) + 1;
      if (!r.deadline) warn.push(`active_panels ${r.phase}: brak deadline`);
      else if (DateTime.fromJSDate(r.deadline) < DateTime.now())
        warn.push(`active_panels ${r.phase}: deadline w przeszłości`);
    }

    for (const [phase, n] of Object.entries(byPhase)) {
      if (n > 1) fail.push(`active_panels: ${phase} ma ${n} aktywne panele`);
    }
  } catch (e) {
    warn.push(`active_panels: błąd sprawdzania (${e.message})`);
  }

  const summary =
    fail.length
      ? `❌ ${fail.length} błędów / ⚠️ ${warn.length} ostrzeżeń / ✅ ${ok.length} OK`
      : warn.length
        ? `⚠️ ${warn.length} ostrzeżeń / ✅ ${ok.length} OK`
        : `✅ Wszystko OK (${ok.length})`;

  return { guildId, ok, warn, fail, summary };
}

/* ======================================================
   PUBLIC API
   ====================================================== */

module.exports = async function validateAllGuilds(client) {
  const reports = [];

  for (const guildId of getAllGuildIds()) {
    try {
      const r = await validateGuild(client, guildId);
      reports.push(r);
    } catch (e) {
      logger.error('validator', 'Guild validation failed', {
        guildId,
        message: e.message,
        stack: e.stack,
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
