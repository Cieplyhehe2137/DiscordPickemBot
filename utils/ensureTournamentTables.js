// utils/ensureTournamentTables.js
// Minimalne "self-heal" tworzenie tabel potrzebnych dla panelu WWW i logów.

async function ensureTournamentState(pool) {
  // Bez CHECK dla kompatybilności z MariaDB / starszym MySQL.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tournament_state (
      id INT NOT NULL,
      phase VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
      is_open TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Zapewniamy jeden wiersz (id=1)
  await pool.query(`
    INSERT INTO tournament_state (id, phase, is_open)
    VALUES (1, 'UNKNOWN', 0)
    ON DUPLICATE KEY UPDATE id = id;
  `);
}

async function ensureTournamentAuditLog(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tournament_audit_log (
      id INT NOT NULL AUTO_INCREMENT,
      guild_id VARCHAR(32) NOT NULL,
      actor_discord_id VARCHAR(32) NOT NULL,
      action VARCHAR(32) NOT NULL,
      old_value VARCHAR(64) DEFAULT NULL,
      new_value VARCHAR(64) DEFAULT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

module.exports = {
  ensureTournamentState,
  ensureTournamentAuditLog,
};
