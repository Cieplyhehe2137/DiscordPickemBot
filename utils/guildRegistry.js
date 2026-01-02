const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

let _loaded = false;
let _configsByGuild = {}; // guildId => config

function _listEnvFiles() {
  const configDir = process.env.GUILD_CONFIG_DIR
    ? path.resolve(process.env.GUILD_CONFIG_DIR)
    : path.join(process.cwd(), 'config');

  // ✅ poprawka: GUILD_ENV_FILES (a nie GUID_ENV_FILES)
  const explicit = (process.env.GUILD_ENV_FILES || '').trim();
  let files = [];

  if (explicit) {
    files = explicit
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(f => (path.isAbsolute(f) ? f : path.join(configDir, f)));
  } else {
    if (!fs.existsSync(configDir)) return [];
    files = fs.readdirSync(configDir)
      .filter(f => f.toLowerCase().endsWith('.env'))
      .map(f => path.join(configDir, f));
  }

  return files.filter(f => fs.existsSync(f));
}

function _validate(cfg, filePath) {
  const required = [
    'GUILD_ID',
    'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME',
    'EXPORT_PANEL_CHANNEL_ID',
    'ARCHIVE_CHANNEL_ID',
    'LOG_CHANNEL_ID',
  ];

  const missing = required.filter(k => !cfg[k] || !String(cfg[k]).trim());
  if (missing.length) {
    const where = filePath ? ` (${path.basename(filePath)})` : '';
    throw new Error(`Brak kluczy w configu guild${where}: ${missing.join(', ')}`);
  }

  return cfg;
}

function loadGuildConfigsOnce() {
  if (_loaded) return _configsByGuild;

  const files = _listEnvFiles();

  // fallback: pojedynczy .env (dla 1 guilda)
  if (!files.length) {
    if (process.env.GUILD_ID && process.env.DB_NAME) {
      const cfg = _validate({
        GUILD_ID: String(process.env.GUILD_ID),
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT || '3306',
        DB_USER: process.env.DB_USER,
        DB_PASS: process.env.DB_PASS,
        DB_NAME: process.env.DB_NAME,
        EXPORT_PANEL_CHANNEL_ID: process.env.EXPORT_PANEL_CHANNEL_ID,
        ARCHIVE_CHANNEL_ID: process.env.ARCHIVE_CHANNEL_ID,
        LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
        // opcjonalne:
        PREDICTIONS_CHANNEL_ID: process.env.PREDICTIONS_CHANNEL_ID,
        SWISS_PREDICTIONS_CHANNEL_ID: process.env.SWISS_PREDICTIONS_CHANNEL_ID,
      }, '.env');

      _configsByGuild[String(cfg.GUILD_ID)] = cfg;
      _loaded = true;
      return _configsByGuild;
    }

    throw new Error('Nie znaleziono żadnych plików config/*.env ani fallback z .env');
  }

  const map = {};
  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = dotenv.parse(raw);

    const cfg = _validate(parsed, filePath);
    cfg.GUILD_ID = String(cfg.GUILD_ID).trim();
    cfg.DB_PORT = cfg.DB_PORT ? String(cfg.DB_PORT) : '3306';
    cfg.__file = filePath;

    if (map[cfg.GUILD_ID]) {
      throw new Error(
        `Duplikat GUILD_ID=${cfg.GUILD_ID} w configach (${filePath} oraz ${map[cfg.GUILD_ID].__file})`
      );
    }
    map[cfg.GUILD_ID] = cfg;
  }

  _configsByGuild = map;
  _loaded = true;
  return _configsByGuild;
}

function getAllGuildConfig() {
  return loadGuildConfigsOnce();
}

function getAllGuildIds() {
  return Object.keys(getAllGuildConfig());
}

function getGuildConfig(guildId) {
  if (!guildId) return null;
  return getAllGuildConfig()[String(guildId)] || null;
}

function getGuildPaths(guildId) {
  const gid = String(guildId || 'noguild');
  const root = process.cwd();
  const archiveDir = path.join(root, 'archiwum', gid);
  const backupDir = path.join(root, 'backup', gid);
  return { archiveDir, backupDir };
}

function ensureGuildDirs(guildId) {
  const { archiveDir, backupDir } = getGuildPaths(guildId);
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
}

module.exports = {
  getAllGuildConfig,
  getAllGuildIds,
  getGuildConfig,
  getGuildPaths,
  ensureGuildDirs,
};
