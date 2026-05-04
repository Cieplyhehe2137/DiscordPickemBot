const { PermissionFlagsBits } = require("discord.js");

/* =========================================================
   ADMIN DIAGNOSTICS
   /admin validate + /admin missing shared logic
========================================================= */

const REQUIRED_TABLES = [
  "events",
  "teams",
  "matches",
  "match_predictions",
  "match_results",
  "match_map_predictions",
  "match_map_results",
  "match_points",
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
];

const SWISS_STAGES = ["stage1", "stage2", "stage3"];

function normalizePhase(phase) {
  return String(phase || "").trim().toUpperCase();
}

function normalizeStage(stage) {
  const value = String(stage || "").trim().toLowerCase();

  if (value === "swiss_stage_1") return "stage1";
  if (value === "swiss_stage_2") return "stage2";
  if (value === "swiss_stage_3") return "stage3";

  return value;
}

function icon(status) {
  if (status === "ok") return "✅";
  if (status === "warn") return "⚠️";
  return "❌";
}

function makeCheck(status, label, details = "") {
  return {
    status,
    label,
    details,
  };
}

function formatCheck(check) {
  const suffix = check.details ? ` — ${check.details}` : "";
  return `${icon(check.status)} ${check.label}${suffix}`;
}

function chunkLines(lines, maxLength = 950) {
  const chunks = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;

    if (next.length > maxLength) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : ["Brak danych."];
}

async function tableExists(pool, tableName) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ?
    `,
    [tableName]
  );

  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function getColumns(pool, tableName) {
  const exists = await tableExists(pool, tableName);
  if (!exists) return [];

  const [rows] = await pool.query(
    `
    SELECT column_name AS name
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ?
    `,
    [tableName]
  );

  return rows.map((r) => r.name);
}

async function hasColumn(pool, tableName, columnName) {
  const columns = await getColumns(pool, tableName);
  return columns.includes(columnName);
}

async function getTableMeta(pool, tableName) {
  const exists = await tableExists(pool, tableName);
  const columns = exists ? await getColumns(pool, tableName) : [];

  return {
    exists,
    columns,
    has(column) {
      return columns.includes(column);
    },
  };
}

function buildGuildWhere(meta, guildId) {
  if (!meta.has("guild_id")) return { sql: "1=1", params: [] };
  return { sql: "guild_id = ?", params: [guildId] };
}

function buildEventWhere(meta, eventId, guildId) {
  const parts = [];
  const params = [];

  if (meta.has("event_id") && eventId) {
    parts.push("event_id = ?");
    params.push(eventId);
  }

  if (meta.has("guild_id")) {
    parts.push("guild_id = ?");
    params.push(guildId);
  }

  return {
    sql: parts.length ? parts.join(" AND ") : "1=1",
    params,
  };
}

async function countRows(pool, tableName, whereSql = "1=1", params = []) {
  const exists = await tableExists(pool, tableName);
  if (!exists) return null;

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM \`${tableName}\` WHERE ${whereSql}`,
    params
  );

  return Number(rows?.[0]?.cnt || 0);
}

async function getActiveEvent(pool, guildId) {
  const meta = await getTableMeta(pool, "events");
  if (!meta.exists) return null;

  const where = [];
  const params = [];

  if (meta.has("guild_id")) {
    where.push("guild_id = ?");
    params.push(guildId);
  }

  if (meta.has("is_active")) {
    where.push("is_active = 1");
  } else if (meta.has("status")) {
    where.push("(status IN ('active', 'open', 'ongoing') OR status IS NULL)");
  }

  const orderBy = meta.has("id") ? "ORDER BY id DESC" : "";

  const [rows] = await pool.query(
    `
    SELECT *
    FROM events
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ${orderBy}
    LIMIT 1
    `,
    params
  );

  if (rows?.[0]) return rows[0];

  const fallbackWhere = [];
  const fallbackParams = [];

  if (meta.has("guild_id")) {
    fallbackWhere.push("guild_id = ?");
    fallbackParams.push(guildId);
  }

  const [fallbackRows] = await pool.query(
    `
    SELECT *
    FROM events
    ${fallbackWhere.length ? `WHERE ${fallbackWhere.join(" AND ")}` : ""}
    ${orderBy}
    LIMIT 1
    `,
    fallbackParams
  );

  return fallbackRows?.[0] || null;
}

async function getLatestEventFromMatches(pool, guildId) {
  const meta = await getTableMeta(pool, "matches");
  if (!meta.exists || !meta.has("event_id")) return null;

  const where = [];
  const params = [];

  if (meta.has("guild_id")) {
    where.push("guild_id = ?");
    params.push(guildId);
  }

  const [rows] = await pool.query(
    `
    SELECT event_id
    FROM matches
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY id DESC
    LIMIT 1
    `,
    params
  );

  return rows?.[0]?.event_id || null;
}

async function resolveEvent(pool, guildId) {
  const event = await getActiveEvent(pool, guildId);

  if (event) {
    return {
      id: event.id,
      name: event.name || event.slug || `Event #${event.id}`,
      slug: event.slug || null,
      phase: event.phase || null,
      status: event.status || null,
      deadline: event.deadline || null,
      source: "events",
      raw: event,
    };
  }

  const latestEventId = await getLatestEventFromMatches(pool, guildId);

  if (latestEventId) {
    return {
      id: latestEventId,
      name: `Event #${latestEventId}`,
      slug: null,
      phase: null,
      status: null,
      deadline: null,
      source: "matches",
      raw: null,
    };
  }

  return null;
}

function getBotPermissionChecks(interaction) {
  const checks = [];

  const me = interaction.guild?.members?.me;
  const channel = interaction.channel;

  if (!interaction.guild) {
    checks.push(makeCheck("error", "Guild", "komenda nie została użyta na serwerze"));
    return checks;
  }

  if (!channel) {
    checks.push(makeCheck("error", "Kanał", "nie udało się pobrać kanału"));
    return checks;
  }

  if (!me) {
    checks.push(makeCheck("warn", "Bot member", "nie udało się pobrać uprawnień bota"));
    return checks;
  }

  const permissions = channel.permissionsFor(me);

  if (!permissions) {
    checks.push(makeCheck("warn", "Uprawnienia kanału", "nie udało się ich odczytać"));
    return checks;
  }

  const required = [
    ["ViewChannel", PermissionFlagsBits.ViewChannel, "widzenie kanału"],
    ["SendMessages", PermissionFlagsBits.SendMessages, "wysyłanie wiadomości"],
    ["EmbedLinks", PermissionFlagsBits.EmbedLinks, "wysyłanie embedów"],
    ["ReadMessageHistory", PermissionFlagsBits.ReadMessageHistory, "czytanie historii"],
  ];

  for (const [, permission, label] of required) {
    if (permissions.has(permission)) {
      checks.push(makeCheck("ok", `Uprawnienie: ${label}`));
    } else {
      checks.push(makeCheck("error", `Brak uprawnienia: ${label}`));
    }
  }

  return checks;
}

async function getValidateReport({ pool, guildId, interaction }) {
  const checks = [];

  checks.push(...getBotPermissionChecks(interaction));

  // DB ping
  try {
    await pool.query("SELECT 1");
    checks.push(makeCheck("ok", "Połączenie z bazą danych"));
  } catch (error) {
    checks.push(makeCheck("error", "Połączenie z bazą danych", error.message));
    return {
      event: null,
      checks,
    };
  }

  // required tables
  for (const tableName of REQUIRED_TABLES) {
    const exists = await tableExists(pool, tableName);
    checks.push(
      exists
        ? makeCheck("ok", `Tabela: ${tableName}`)
        : makeCheck("warn", `Brak tabeli: ${tableName}`)
    );
  }

  const event = await resolveEvent(pool, guildId);

  if (!event) {
    checks.push(makeCheck("error", "Aktywny event", "nie znaleziono eventu ani event_id z meczów"));
    return {
      event: null,
      checks,
    };
  }

  checks.push(
    makeCheck(
      "ok",
      "Event",
      `${event.name}${event.source === "matches" ? " / fallback z matches" : ""}`
    )
  );

  if (event.id) {
    checks.push(makeCheck("ok", "Event ID", String(event.id)));
  } else {
    checks.push(makeCheck("error", "Event ID", "brak"));
  }

  if (event.phase) {
    checks.push(makeCheck("ok", "Faza", event.phase));
  } else {
    checks.push(makeCheck("warn", "Faza", "brak phase w evencie"));
  }

  if (event.deadline) {
    checks.push(makeCheck("ok", "Deadline", String(event.deadline)));
  } else {
    checks.push(makeCheck("warn", "Deadline", "brak deadline"));
  }

  // teams
  const teamsMeta = await getTableMeta(pool, "teams");
  if (teamsMeta.exists) {
    const where = buildEventWhere(teamsMeta, event.id, guildId);
    const count = await countRows(pool, "teams", where.sql, where.params);

    if (count === null) {
      checks.push(makeCheck("warn", "Drużyny", "nie udało się policzyć"));
    } else if (count > 0) {
      checks.push(makeCheck("ok", "Drużyny", `${count}`));
    } else {
      checks.push(makeCheck("warn", "Drużyny", "0 rekordów"));
    }
  }

  // matches
  const matchesMeta = await getTableMeta(pool, "matches");
  if (matchesMeta.exists) {
    const where = buildEventWhere(matchesMeta, event.id, guildId);
    const matchesCount = await countRows(pool, "matches", where.sql, where.params);

    if (matchesCount > 0) {
      checks.push(makeCheck("ok", "Mecze", `${matchesCount}`));
    } else {
      checks.push(makeCheck("warn", "Mecze", "0 rekordów"));
    }

    if (matchesMeta.has("best_of")) {
      const [rows] = await pool.query(
        `
        SELECT COUNT(*) AS cnt
        FROM matches
        WHERE ${where.sql}
          AND (best_of IS NULL OR best_of = 0)
        `,
        where.params
      );

      const missingBo = Number(rows?.[0]?.cnt || 0);

      checks.push(
        missingBo === 0
          ? makeCheck("ok", "BO meczów")
          : makeCheck("warn", "Mecze bez BO", `${missingBo}`)
      );
    }

    if (matchesMeta.has("starts_at")) {
      const [rows] = await pool.query(
        `
        SELECT COUNT(*) AS cnt
        FROM matches
        WHERE ${where.sql}
          AND starts_at IS NULL
        `,
        where.params
      );

      const missingStart = Number(rows?.[0]?.cnt || 0);

      checks.push(
        missingStart === 0
          ? makeCheck("ok", "Godziny startu meczów")
          : makeCheck("warn", "Mecze bez starts_at", `${missingStart}`)
      );
    }
  }

  // active panels sanity check
  const panelsMeta = await getTableMeta(pool, "active_panels");
  if (panelsMeta.exists) {
    const where = buildGuildWhere(panelsMeta, guildId);
    const count = await countRows(pool, "active_panels", where.sql, where.params);

    checks.push(
      count > 0
        ? makeCheck("ok", "Aktywne panele", `${count}`)
        : makeCheck("warn", "Aktywne panele", "0 rekordów")
    );
  }

  return {
    event,
    checks,
  };
}

async function getMissingReport({ pool, guildId }) {
  const event = await resolveEvent(pool, guildId);
  const sections = [];

  if (!event) {
    return {
      event: null,
      sections: [
        {
          title: "Event",
          lines: ["❌ Nie znaleziono aktywnego eventu ani event_id z meczów."],
        },
      ],
    };
  }

  // Swiss official results
  const swissMeta = await getTableMeta(pool, "swiss_results");
  if (swissMeta.exists) {
    const lines = [];

    for (const stage of SWISS_STAGES) {
      const whereParts = [];
      const params = [];

      if (swissMeta.has("event_id")) {
        whereParts.push("event_id = ?");
        params.push(event.id);
      }

      if (swissMeta.has("guild_id")) {
        whereParts.push("guild_id = ?");
        params.push(guildId);
      }

      if (swissMeta.has("stage")) {
        whereParts.push("LOWER(stage) = ?");
        params.push(stage);
      }

      const whereSql = whereParts.length ? whereParts.join(" AND ") : "1=1";

      const [rows] = await pool.query(
        `
        SELECT *
        FROM swiss_results
        WHERE ${whereSql}
        LIMIT 1
        `,
        params
      );

      const row = rows?.[0];

      if (!row) {
        lines.push(`❌ Swiss ${stage} — brak oficjalnych wyników`);
        continue;
      }

      const missing = [];

      if (swissMeta.has("correct_3_0") && !row.correct_3_0) {
        missing.push("correct_3_0");
      }

      if (swissMeta.has("correct_0_3") && !row.correct_0_3) {
        missing.push("correct_0_3");
      }

      if (swissMeta.has("correct_advancing") && !row.correct_advancing) {
        missing.push("correct_advancing");
      }

      if (missing.length) {
        lines.push(`⚠️ Swiss ${stage} — brakuje: ${missing.join(", ")}`);
      } else {
        lines.push(`✅ Swiss ${stage} — OK`);
      }
    }

    sections.push({
      title: "Swiss",
      lines,
    });
  } else {
    sections.push({
      title: "Swiss",
      lines: ["⚠️ Brak tabeli swiss_results."],
    });
  }

  // Matches missing series results
  const matchesMeta = await getTableMeta(pool, "matches");
  const resultsMeta = await getTableMeta(pool, "match_results");

  if (matchesMeta.exists) {
    const lines = [];

    const matchesWhere = buildEventWhere(matchesMeta, event.id, guildId);

    if (resultsMeta.exists) {
      const joinOn = [];

      if (resultsMeta.has("match_id")) {
        joinOn.push("mr.match_id = m.id");
      }

      if (resultsMeta.has("guild_id") && matchesMeta.has("guild_id")) {
        joinOn.push("mr.guild_id = m.guild_id");
      }

      if (resultsMeta.has("event_id") && matchesMeta.has("event_id")) {
        joinOn.push("mr.event_id = m.event_id");
      }

      const resultMissingCondition = [];

      if (resultsMeta.has("res_a")) resultMissingCondition.push("mr.res_a IS NULL");
      if (resultsMeta.has("res_b")) resultMissingCondition.push("mr.res_b IS NULL");

      const missingCondition = resultMissingCondition.length
        ? `(${resultMissingCondition.join(" OR ")})`
        : "mr.id IS NULL";

      const [rows] = await pool.query(
        `
        SELECT
          m.id,
          ${matchesMeta.has("team_a") ? "m.team_a" : "NULL"} AS team_a,
          ${matchesMeta.has("team_b") ? "m.team_b" : "NULL"} AS team_b
        FROM matches m
        LEFT JOIN match_results mr
          ON ${joinOn.length ? joinOn.join(" AND ") : "mr.match_id = m.id"}
        WHERE ${matchesWhere.sql.replaceAll("event_id", "m.event_id").replaceAll("guild_id", "m.guild_id")}
          AND (${missingCondition})
        ORDER BY m.id ASC
        LIMIT 25
        `,
        matchesWhere.params
      );

      if (!rows.length) {
        lines.push("✅ Wyniki meczów — OK");
      } else {
        for (const row of rows) {
          const name =
            row.team_a || row.team_b
              ? `${row.team_a || "?"} vs ${row.team_b || "?"}`
              : `match_id ${row.id}`;

          lines.push(`❌ ${name} — brak wyniku serii`);
        }

        if (rows.length === 25) {
          lines.push("⚠️ Pokazuję pierwsze 25 braków.");
        }
      }
    } else {
      lines.push("⚠️ Brak tabeli match_results.");
    }

    sections.push({
      title: "Mecze",
      lines,
    });
  }

  // Maps missing results
  const mapResultsMeta = await getTableMeta(pool, "match_map_results");

  if (matchesMeta.exists && mapResultsMeta.exists) {
    const lines = [];

    const matchesWhere = buildEventWhere(matchesMeta, event.id, guildId);

    if (mapResultsMeta.has("match_id")) {
      const [rows] = await pool.query(
        `
        SELECT
          m.id AS match_id,
          ${matchesMeta.has("team_a") ? "m.team_a" : "NULL"} AS team_a,
          ${matchesMeta.has("team_b") ? "m.team_b" : "NULL"} AS team_b,
          COUNT(mmr.id) AS maps_count
        FROM matches m
        LEFT JOIN match_map_results mmr
          ON mmr.match_id = m.id
        WHERE ${matchesWhere.sql.replaceAll("event_id", "m.event_id").replaceAll("guild_id", "m.guild_id")}
        GROUP BY m.id
        HAVING maps_count = 0
        ORDER BY m.id ASC
        LIMIT 25
        `,
        matchesWhere.params
      );

      if (!rows.length) {
        lines.push("✅ Wyniki map — OK albo brak meczów wymagających map.");
      } else {
        for (const row of rows) {
          const name =
            row.team_a || row.team_b
              ? `${row.team_a || "?"} vs ${row.team_b || "?"}`
              : `match_id ${row.match_id}`;

          lines.push(`⚠️ ${name} — brak wyników map`);
        }

        if (rows.length === 25) {
          lines.push("⚠️ Pokazuję pierwsze 25 braków.");
        }
      }
    } else {
      lines.push("⚠️ match_map_results nie ma kolumny match_id.");
    }

    sections.push({
      title: "Mapy",
      lines,
    });
  }

  // Duplicates sanity
  const duplicateSections = await getDuplicateChecks(pool, guildId, event.id);
  if (duplicateSections.length) {
    sections.push({
      title: "Duplikaty",
      lines: duplicateSections,
    });
  }

  return {
    event,
    sections,
  };
}

async function getDuplicateChecks(pool, guildId, eventId) {
  const checks = [];

  const candidates = [
    {
      table: "match_predictions",
      group: ["user_id", "match_id"],
    },
    {
      table: "match_results",
      group: ["match_id"],
    },
    {
      table: "swiss_predictions",
      group: ["user_id", "stage"],
    },
    {
      table: "swiss_results",
      group: ["stage"],
    },
    {
      table: "playoffs_predictions",
      group: ["user_id"],
    },
    {
      table: "playoffs_results",
      group: [],
    },
    {
      table: "doubleelim_predictions",
      group: ["user_id"],
    },
    {
      table: "doubleelim_results",
      group: [],
    },
    {
      table: "playin_predictions",
      group: ["user_id"],
    },
    {
      table: "playin_results",
      group: [],
    },
  ];

  for (const candidate of candidates) {
    const meta = await getTableMeta(pool, candidate.table);
    if (!meta.exists) continue;

    const groupColumns = candidate.group.filter((column) => meta.has(column));

    if (!groupColumns.length) continue;

    const where = buildEventWhere(meta, eventId, guildId);

    const [rows] = await pool.query(
      `
      SELECT ${groupColumns.map((c) => `\`${c}\``).join(", ")}, COUNT(*) AS cnt
      FROM \`${candidate.table}\`
      WHERE ${where.sql}
      GROUP BY ${groupColumns.map((c) => `\`${c}\``).join(", ")}
      HAVING cnt > 1
      LIMIT 10
      `,
      where.params
    );

    if (rows.length) {
      checks.push(`⚠️ ${candidate.table} — duplikaty: ${rows.length}`);
    }
  }

  if (!checks.length) {
    checks.push("✅ Nie wykryto podstawowych duplikatów.");
  }

  return checks;
}

module.exports = {
  getValidateReport,
  getMissingReport,
  formatCheck,
  chunkLines,
  normalizePhase,
  normalizeStage,
};