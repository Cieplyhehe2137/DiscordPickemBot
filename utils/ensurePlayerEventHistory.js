// utils/ensurePlayerEventHistory.js

const { logInfo } = require("./logger");

async function ensurePlayerEventHistory(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_event_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

      guild_id VARCHAR(32) NOT NULL,
      event_id BIGINT UNSIGNED NOT NULL,
      user_id VARCHAR(32) NOT NULL,

      event_name VARCHAR(255) NOT NULL,

      final_rank INT NULL,
      participant_count INT NOT NULL DEFAULT 0,

      total_points INT NOT NULL DEFAULT 0,
      series_points INT NOT NULL DEFAULT 0,
      map_points INT NOT NULL DEFAULT 0,

      predictions INT NOT NULL DEFAULT 0,
      settled_matches INT NOT NULL DEFAULT 0,

      winner_hits INT NOT NULL DEFAULT 0,
      series_exacts INT NOT NULL DEFAULT 0,

      settled_maps INT NOT NULL DEFAULT 0,
      map_winner_hits INT NOT NULL DEFAULT 0,
      exact_maps INT NOT NULL DEFAULT 0,

      best_streak INT NOT NULL DEFAULT 0,

      finished_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (id),

      UNIQUE KEY uniq_player_event (
        guild_id,
        event_id,
        user_id
      ),

      KEY idx_player_history (
        guild_id,
        user_id
      ),

      KEY idx_event_history (
        guild_id,
        event_id
      )
    )
  `);

  logInfo("database", "player_event_history table ensured");
}

module.exports = ensurePlayerEventHistory;
