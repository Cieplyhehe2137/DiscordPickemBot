// utils/ensureTournamentTables.js
// Self-heal tworzenie / migracja tabel potrzebnych dla panelu WWW i blokad typowania.

async function ensureTournamentState(pool, guildId) {
  if (!guildId) throw new Error('ensureTournamentState: missing guildId');

  // NOWY SCHEMAT: per-guild
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tournament_state (
      guild_id VARCHAR(32) NOT NULL,
      id INT NOT NULL,
      phase VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
      is_open TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // MIGRACJA: jeżeli stara wersja była bez guild_id i z PK(id)
  // (CREATE TABLE IF NOT EXISTS nic nie zmieni istniejącej tabeli)
  try {
    const [hasGuild] = await pool.query(
      "SHOW COLUMNS FROM tournament_state LIKE 'guild_id'"
    );

    if (!hasGuild.length) {
      // 1) dodaj kolumnę jako NULL (żeby nie wywaliło na istniejących rekordach)
      await pool.query(
        "ALTER TABLE tournament_state ADD COLUMN guild_id VARCHAR(32) NULL FIRST"
      );

      // 2) ustaw guild_id dla istniejących wierszy (stara tabela była globalna -> przypisz do tego guilda)
      await pool.query(
        "UPDATE tournament_state SET guild_id = ? WHERE guild_id IS NULL OR guild_id = ''",
        [String(guildId)]
      );

      // 3) ustaw NOT NULL
      await pool.query(
        "ALTER TABLE tournament_state MODIFY guild_id VARCHAR(32) NOT NULL"
      );

      // 4) zmień primary key
      await pool.query("ALTER TABLE tournament_state DROP PRIMARY KEY");
      await pool.query("ALTER TABLE tournament_state ADD PRIMARY KEY (guild_id, id)");
    }
  } catch (_) {
    // jak się nie da (jakieś dziwne uprawnienia), to trudno — ale w normalnym MySQL przejdzie
  }

  // Zapewniamy jeden wiersz (guild_id, id=1)
  await pool.query(
    `
      INSERT INTO tournament_state (guild_id, id, phase, is_open)
      VALUES (?, 1, 'UNKNOWN', 0)
      ON DUPLICATE KEY UPDATE id = id;
    `,
    [String(guildId)]
  );
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
      PRIMARY KEY (id),
      KEY idx_audit_guild (guild_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

module.exports = {
  ensureTournamentState,
  ensureTournamentAuditLog,
};
