// utils/restoreBackup.js
const fs = require('fs');
const pool = require('../db');

module.exports = async function restoreBackup(sqlFilePath) {
  if (!fs.existsSync(sqlFilePath)) {
    throw new Error('Plik backupu nie istnieje');
  }

  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  if (!sql.trim()) {
    throw new Error('Plik backupu jest pusty');
  }

  const connection = await pool.getConnection();

  try {
    console.log('[RESTORE] start');
    await connection.beginTransaction();

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const [tables] = await connection.query(`
      SELECT TABLE_NAME AS name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `);

    for (const { name } of tables) {
      console.log('[RESTORE] DELETE FROM', name);
      await connection.query(`DELETE FROM \`${name}\``);
    }

    console.log('[RESTORE] INSERT START');

    // 🔥 JEDEN CALL, CAŁY SQL
    await connection.query(sql);

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();

    console.log('[RESTORE] SUCCESS');
  } catch (err) {
    await connection.rollback();
    console.error('[RESTORE] ROLLBACK', err);
    throw err;
  } finally {
    connection.release();
  }
};
