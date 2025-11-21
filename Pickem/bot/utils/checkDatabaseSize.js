const pool = require('../db');

async function checkDatabaseSize() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        table_schema AS database_name,
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      GROUP BY table_schema;
    `);

    if (rows.length === 0) {
      console.log('⚠️ Nie udało się pobrać rozmiaru bazy danych.');
      return;
    }

    const size = rows[0].size_mb;
    console.log(`📊 Rozmiar bazy danych: ${size} MB`);
  } catch (error) {
    console.error('❌ Błąd podczas pobierania rozmiaru bazy:', error);
  }
}

module.exports = { checkDatabaseSize };
