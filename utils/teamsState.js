const db = require('../db');
const { withGuild } = require('./guildContext');

async function getTeams(guildId) {
  return withGuild(guildId, async () => {
    const pool = db.getPoolForGuild(guildId);
    const [rows] = await pool.query(
      `SELECT id, name, short_name, active, sort_order FROM teams WHERE guild_id = ? ORDER BY sort_order ASC, name ASC`,
      [guildId]
    );
    return rows;
  })
}

async function saveTeams(guildId, teams) {
  return withGuild(guildId, async () => {
    const pool = db.getPoolForGuild(guildId);

    const values = teams.map((t, i) => [
      guildId,
      t.name,
      t.short_name ?? null,
      t.active ?? 1,
      i + 1,
    ]);

    await pool.query('DELETE FROM teams WHERE guild_id = ?', [guildId]);
    if (values.length) {
      await pool.query(
        `INSERT INTO teams (guild_id, name, short_name, active, sort_order) VALUES ?`,
        [values]
      );
    }
  });
}

async function resetTeams(guildId) {
  return withGuild(guildId, async () => {
    const pool = db.getPoolForGuild(guildId);
    await pool.query('DELETE FROM teams WHERE guild_id = ?', [guildId]);
  });
}

module.exports = { getTeams, saveTeams, resetTeams };
