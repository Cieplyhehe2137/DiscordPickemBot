// utils/ensureTournamentTables.js
//
// Self-heal tabel używanych przez bota.
// Funkcje są bezpieczne do wielokrotnego uruchamiania,
// ponieważ korzystają z CREATE TABLE IF NOT EXISTS.

// ======================================================
// TOURNAMENT STATE
// ======================================================

async function ensureTournamentState(pool) {
  // Bez CHECK dla kompatybilności
  // z MariaDB / starszym MySQL.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tournament_state (
      id INT NOT NULL,

      phase VARCHAR(50)
        NOT NULL
        DEFAULT 'UNKNOWN',

      is_open TINYINT(1)
        NOT NULL
        DEFAULT 0,

      updated_at TIMESTAMP
        NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id)
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4;
  `);

  // Zapewniamy jeden wiersz globalnego stanu.
  await pool.query(`
    INSERT INTO tournament_state (
      id,
      phase,
      is_open
    )
    VALUES (
      1,
      'UNKNOWN',
      0
    )

    ON DUPLICATE KEY UPDATE
      id = id;
  `);
}

// ======================================================
// TOURNAMENT AUDIT LOG
// ======================================================

async function ensureTournamentAuditLog(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tournament_audit_log (
      id INT NOT NULL AUTO_INCREMENT,

      guild_id VARCHAR(32)
        NOT NULL,

      actor_discord_id VARCHAR(32)
        NOT NULL,

      action VARCHAR(32)
        NOT NULL,

      old_value VARCHAR(64)
        DEFAULT NULL,

      new_value VARCHAR(64)
        DEFAULT NULL,

      created_at TIMESTAMP
        NULL
        DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (id),

      KEY idx_tournament_audit_guild (
        guild_id
      ),

      KEY idx_tournament_audit_created (
        created_at
      )
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4;
  `);
}

// ======================================================
// MVP
// ======================================================

async function ensureMvpTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mvp_candidates (
      id INT
        AUTO_INCREMENT
        PRIMARY KEY,

      guild_id VARCHAR(64)
        NOT NULL,

      event_id INT
        NOT NULL,

      nickname VARCHAR(100)
        NOT NULL,

      team_name VARCHAR(100)
        DEFAULT NULL,

      image_url TEXT
        DEFAULT NULL,

      is_active TINYINT(1)
        NOT NULL
        DEFAULT 1,

      created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      KEY idx_mvp_candidates_event (
        guild_id,
        event_id
      ),

      KEY idx_mvp_candidates_active (
        guild_id,
        event_id,
        is_active
      )
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mvp_predictions (
      id INT
        AUTO_INCREMENT
        PRIMARY KEY,

      guild_id VARCHAR(64)
        NOT NULL,

      event_id INT
        NOT NULL,

      user_id VARCHAR(64)
        NOT NULL,

      username VARCHAR(100)
        NOT NULL,

      candidate_id INT
        NOT NULL,

      created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_mvp_prediction_user (
        guild_id,
        event_id,
        user_id
      ),

      KEY idx_mvp_predictions_event (
        guild_id,
        event_id
      ),

      KEY idx_mvp_predictions_candidate (
        guild_id,
        event_id,
        candidate_id
      )
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mvp_results (
      id INT
        AUTO_INCREMENT
        PRIMARY KEY,

      guild_id VARCHAR(64)
        NOT NULL,

      event_id INT
        NOT NULL,

      candidate_id INT
        NOT NULL,

      active TINYINT(1)
        NOT NULL
        DEFAULT 1,

      created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_mvp_result_active (
        guild_id,
        event_id,
        active
      ),

      KEY idx_mvp_results_event (
        guild_id,
        event_id
      )
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mvp_scores (
      id INT
        AUTO_INCREMENT
        PRIMARY KEY,

      guild_id VARCHAR(64)
        NOT NULL,

      event_id INT
        NOT NULL,

      user_id VARCHAR(64)
        NOT NULL,

      displayname VARCHAR(100)
        NOT NULL,

      points INT
        NOT NULL
        DEFAULT 0,

      created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_mvp_scores_user (
        guild_id,
        event_id,
        user_id
      ),

      KEY idx_mvp_scores_event (
        guild_id,
        event_id
      )
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4;
  `);
}

// ======================================================
// PENDING MATCH EDITS
// ======================================================

async function ensurePendingMatchEditsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pending_match_edits (
      id BIGINT UNSIGNED
        NOT NULL
        AUTO_INCREMENT,

      guild_id VARCHAR(32)
        NOT NULL,

      user_id VARCHAR(32)
        NOT NULL,

      match_id BIGINT UNSIGNED
        NOT NULL,

      phase VARCHAR(64)
        DEFAULT NULL,

      team_a VARCHAR(255)
        DEFAULT NULL,

      team_b VARCHAR(255)
        DEFAULT NULL,

      best_of INT
        DEFAULT NULL,

      match_no INT
        DEFAULT NULL,

      start_time_utc DATETIME
        DEFAULT NULL,

      created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (id),

      KEY idx_pending_match_edits_lookup (
        guild_id,
        user_id,
        id
      ),

      KEY idx_pending_match_edits_match (
        guild_id,
        match_id
      ),

      KEY idx_pending_match_edits_created (
        created_at
      )
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4;
  `);
}

// ======================================================
// ENSURE ALL
// ======================================================

async function ensureTournamentTables(pool) {
  if (!pool || typeof pool.query !== "function") {
    throw new Error("ensureTournamentTables: invalid database pool");
  }

  await ensureTournamentState(pool);

  await ensureTournamentAuditLog(pool);

  await ensureMvpTables(pool);

  await ensurePendingMatchEditsTable(pool);
}

// ======================================================
// EXPORTS
// ======================================================
//
// Eksportujemy funkcję jako główny export,
// ale dokładamy też properties.
//
// Dzięki temu działają OBIE formy:
//
// const ensureTournamentTables = require(...);
//
// oraz:
//
// const {
//   ensureTournamentState
// } = require(...);
//
// ======================================================

module.exports = ensureTournamentTables;

module.exports.ensureTournamentTables = ensureTournamentTables;

module.exports.ensureTournamentState = ensureTournamentState;

module.exports.ensureTournamentAuditLog = ensureTournamentAuditLog;

module.exports.ensureMvpTables = ensureMvpTables;

module.exports.ensurePendingMatchEditsTable = ensurePendingMatchEditsTable;
