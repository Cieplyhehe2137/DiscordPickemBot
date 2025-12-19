require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,     // np. 'localhost' lub adres serwera MySQL
  user: process.env.DB_USER,     // nazwa użytkownika bazy
  password: process.env.DB_PASS, // hasło do bazy
  database: process.env.DB_NAME, // nazwa bazy danych
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 200,
  queueLimit: 0,
  multipleStatements: true
});

// Test połączenia i log
(async () => {
  try {
    const [rows] = await pool.query('SELECT 1');
    console.log('✅ Połączono z bazą MySQL! Test zapytania SELECT 1 wykonany:', rows);
  } catch (err) {
    console.error('❌ Błąd połączenia z MySQL:', err);
  }
})();

module.exports = pool;
