// utils/validateConfig.js
const fs = require("fs");
const path = require("path");
const pool = require("./db"); // mysql2/promise pool
const { DateTime } = require("luxon");

const REQUIRED_ENV = [
  "DISCORD_TOKEN",
  "CLIENT_ID",
  "GUILD_ID",
  "DB_HOST",
  "DB_USER",
  "DB_NAME",
  "DB_PORT",
  "EXPORT_CHANNEL_ID",
  "LOG_CHANNEL_ID",
  "EXPORT_PANEL_CHANNEL_ID",
  "ADMIN_PIN",
];

const REQUIRED_TABLES = [
  "swiss_predictions",
  "swiss_results",
  "swiss_scores",
  "playoffs_predictions",
  "playoffs_results",
  "playoffs_scores",
  "doubleelim_predictions",
  "doubleelim_results",
  "doubleelim_scores",
  "playin_predictions",
  "playin_results",
  "playin_scores",
  "active_panels",
];

const MIN_COLUMNS = {
  swiss_predictions: [
    "user_id",
    "stage",
    "displayname",
    "pick_3_0",
    "pick_0_3",
    "advancing",
    "active",
  ],
  swiss_results: ["stage", "correct_3_0", "correct_0_3", "correct_advancing", "active"],
  swiss_scores: ["user_id", "stage", "points"],

  playoffs_predictions: [
    "user_id",
    "semifinalists",
    "finalists",
    "winner",
    "third_place_winner",
    "displayname",
    "active",
  ],
  // ✅ dopasowane do Twojego DDL:
  playoffs_results: [
    "correct_semifinalists",
    "correct_finalists",
    "correct_winner",
    "correct_third_place_winner",
    "active",
  ],
  playoffs_scores: ["user_id", "points"],

  doubleelim_predictions: [
    "user_id",
    "upper_final_a",
    "lower_final_a",
    "upper_final_b",
    "lower_final_b",
    "displayname",
    "active",
  ],
  doubleelim_results: ["upper_final_a", "lower_final_a", "upper_final_b", "lower_final_b", "active"],
  doubleelim_scores: ["user_id", "points"],

  playin_predictions: ["user_id", "teams", "displayname", "active"],
  playin_results: ["correct_teams", "active"],
  playin_scores: ["user_id", "points"],

  active_panels: ["phase", "message_id", "deadline", "reminded", "active"],
};

const MAX_DROPDOWN_OPTIONS = 25;

const PHASES = [
  "swiss_stage1",
  "swiss_stage2",
  "swiss_stage3",
  "playoffs",
  "double_elim",
  "playin",
];

function normalizeTeam(name, officials) {
  if (!name || typeof name !== "string") return name;
  const low = name.toLowerCase().trim();
  for (const off of officials) {
    if (typeof off === "string" && off.toLowerCase() === low) return off;
  }
  return name;
}

async function ensureTableExists(table) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [table]);
  return rows.length > 0;
}

async function getColumns(table) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
  return rows.map((r) => r.Field);
}

async function distinctTeamsFromResults() {
  const collected = new Set();

  const addFrom = (val) => {
    if (!val) return;
    try {
      if (typeof val === "string") {
        if (val.trim().startsWith("[")) {
          const arr = JSON.parse(val);
          if (Array.isArray(arr))
            arr.forEach((v) => typeof v === "string" && collected.add(v));
        } else {
          val
            .split(",")
            .map((s) => s.trim())
            .forEach((v) => v && collected.add(v));
        }
      } else if (Array.isArray(val)) {
        val.forEach((v) => typeof v === "string" && collected.add(v));
      }
    } catch {}
  };

  try {
    const [rows] = await pool.query(
      "SELECT correct_3_0, correct_0_3, correct_advancing FROM swiss_results WHERE active=1"
    );
    for (const r of rows) {
      addFrom(r.correct_3_0);
      addFrom(r.correct_0_3);
      addFrom(r.correct_advancing);
    }
  } catch {}

  try {
    const [rows] = await pool.query(
      "SELECT correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner FROM playoffs_results WHERE active=1"
    );
    for (const r of rows) {
      addFrom(r.correct_semifinalists);
      addFrom(r.correct_finalists);
      addFrom(r.correct_winner);
      addFrom(r.correct_third_place_winner);
    }
  } catch {}

  try {
    const [rows] = await pool.query(
      "SELECT upper_final_a, lower_final_a, upper_final_b, lower_final_b FROM doubleelim_results WHERE active=1"
    );
    for (const r of rows) {
      addFrom(r.upper_final_a);
      addFrom(r.lower_final_a);
      addFrom(r.upper_final_b);
      addFrom(r.lower_final_b);
    }
  } catch {}

  try {
    const [rows] = await pool.query(
      "SELECT correct_teams FROM playin_results WHERE active=1"
    );
    for (const r of rows) addFrom(r.correct_teams);
  } catch {}

  return Array.from(collected);
}

async function validateActivePanels() {
  const [rows] = await pool.query("SELECT * FROM active_panels WHERE active=1");
  return rows;
}

async function checkGuildChannels(client, ids) {
  const results = {};
  for (const key of Object.keys(ids)) {
    const id = ids[key];
    if (!id) {
      results[key] = { ok: false, reason: "brak ID" };
      continue;
    }
    try {
      const ch = await client.channels.fetch(id);
      results[key] = { ok: !!ch, type: ch?.type ?? "unknown" };
    } catch (e) {
      results[key] = { ok: false, reason: e.message || "fetch error" };
    }
  }
  return results;
}

module.exports = async function runValidator(client) {
  const ok = [];
  const warn = [];
  const fail = [];
  const extraNotes = [];

  let teams = [];
  const teamsPath = path.join(__dirname, "../teams.json");
  try {
    const raw = fs.readFileSync(teamsPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
      fail.push("teams.json: musi zawierać tablicę stringów (nazw drużyn).");
    } else {
      teams = parsed;

      const seen = new Map();
      const dups = [];
      for (const t of teams) {
        const k = t.toLowerCase();
        if (seen.has(k)) dups.push(`"${t}" ~ "${seen.get(k)}"`);
        else seen.set(k, t);
      }
      if (dups.length) {
        fail.push(`teams.json: duplikaty nazw (case-insensitive) → ${dups.join(", ")}`);
      } else {
        ok.push(`teams.json: ${teams.length} drużyn, brak duplikatów.`);
      }

      if (teams.length > MAX_DROPDOWN_OPTIONS) {
        warn.push(
          `teams.json: ${teams.length} opcji > ${MAX_DROPDOWN_OPTIONS}. Rozważ podział na kilka dropdownów/paginację.`
        );
      } else {
        ok.push(`Dropdown-ready: ${teams.length} ≤ ${MAX_DROPDOWN_OPTIONS}.`);
      }
    }
  } catch (e) {
    fail.push(`teams.json: błąd odczytu/parsingu – ${e.message}`);
  }

  const missingEnv = REQUIRED_ENV.filter(
    (k) => !process.env[k] || String(process.env[k]).trim() === ""
  );
  if (missingEnv.length) {
    fail.push(`.env: brak zmiennych → ${missingEnv.join(", ")}`);
  } else {
    ok.push(".env: wszystkie kluczowe zmienne obecne.");
  }

  const channelChecks = await checkGuildChannels(client, {
    EXPORT_CHANNEL_ID: process.env.EXPORT_CHANNEL_ID,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
    EXPORT_PANEL_CHANNEL_ID: process.env.EXPORT_PANEL_CHANNEL_ID,
  });
  for (const [key, res] of Object.entries(channelChecks)) {
    if (res.ok) ok.push(`Kanał ${key}: OK (typ: ${res.type})`);
    else fail.push(`Kanał ${key}: NIEZNALAZIONY – ${res.reason || "brak"}`);
  }

  try {
    const notFound = [];
    for (const t of REQUIRED_TABLES) {
      const exists = await ensureTableExists(t);
      if (!exists) notFound.push(t);
    }
    if (notFound.length) {
      fail.push(`DB: brak wymaganych tabel → ${notFound.join(", ")}`);
    } else {
      ok.push("DB: wszystkie wymagane tabele istnieją.");

      for (const [table, mustCols] of Object.entries(MIN_COLUMNS)) {
        const cols = await getColumns(table);
        const missing = mustCols.filter((c) => !cols.includes(c));
        if (missing.length) {
          fail.push(`DB: tabela \`${table}\` – brak kolumn: ${missing.join(", ")}`);
        } else {
          ok.push(`DB: \`${table}\` – minimalny zestaw kolumn OK.`);
        }
      }
    }
  } catch (e) {
    fail.push(`DB: błąd sprawdzania schematu – ${e.message}`);
  }

  try {
    const distinct = await distinctTeamsFromResults();
    if (distinct.length) {
      const officialsLower = new Set(teams.map((t) => t.toLowerCase()));
      const notInList = distinct
        .filter((x) => !officialsLower.has(String(x).toLowerCase()))
        .sort((a, b) => String(a).localeCompare(String(b)));

      if (notInList.length) {
        warn.push(`Wyniki zawierają drużyny, których nie ma w teams.json → ${notInList.join(", ")}`);
        extraNotes.push("Wskazówka: zaktualizuj teams.json lub znormalizuj aliasy przed zapisem wyników.");
      } else {
        ok.push("Wyniki: wszystkie drużyny znajdują się w teams.json.");
      }
    } else {
      warn.push("Wyniki: brak aktywnych wpisów do porównania (OK jeśli turniej jeszcze nie trwa).");
    }
  } catch (e) {
    fail.push(`Wyniki vs teams.json: błąd odczytu – ${e.message}`);
  }

  try {
    const rows = await validateActivePanels();
    const byPhase = new Map();
    for (const r of rows) {
      const phase = String(r.phase);
      if (!byPhase.has(phase)) byPhase.set(phase, []);
      byPhase.get(phase).push(r);
    }

    for (const phase of PHASES) {
      const arr = byPhase.get(phase) || [];
      if (arr.length === 0) {
        warn.push(`active_panels: faza "${phase}" nie ma aktywnego panelu (OK jeśli jeszcze nie startowała).`);
        continue;
      }
      if (arr.length > 1) {
        fail.push(`active_panels: faza "${phase}" ma >1 aktywny panel (${arr.length}) – scal/wyłącz duplikaty.`);
      }

      for (const p of arr) {
        const dl = p.deadline ? DateTime.fromJSDate(p.deadline) : null;
        if (!dl) {
          fail.push(`active_panels: "${phase}" – brak deadline.`);
        } else if (dl < DateTime.now()) {
          warn.push(`active_panels: "${phase}" – deadline jest w przeszłości (${dl.toISO()}).`);
        } else {
          ok.push(`active_panels: "${phase}" – deadline OK (${dl.toISO()}).`);
        }

        if (typeof p.reminded !== "number" && typeof p.reminded !== "boolean") {
          warn.push(`active_panels: "${phase}" – nietypowy typ kolumny reminded (${typeof p.reminded}).`);
        }
      }
    }
  } catch (e) {
    fail.push(`active_panels: błąd weryfikacji – ${e.message}`);
  }

  if (teams.length > MAX_DROPDOWN_OPTIONS) {
    warn.push(`Dropdowny: ${teams.length} > 25 – rozbij listę na kilka selectów lub dodaj paginację (np. A–L, M–Z).`);
  } else {
    ok.push("Dropdowny: limity opcji wyglądałyby OK dla pojedynczego selecta.");
  }

  const summary = fail.length
    ? `❌ ${fail.length} błędów / ⚠️ ${warn.length} ostrzeżeń / ✅ ${ok.length} OK`
    : warn.length
      ? `⚠️ ${warn.length} ostrzeżeń / ✅ ${ok.length} OK`
      : `✅ Wszystko wygląda zdrowo (${ok.length} testów OK)`;

  return { ok, warn, fail, summary, extraNotes };
};
