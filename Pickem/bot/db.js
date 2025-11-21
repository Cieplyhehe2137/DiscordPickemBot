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
  queueLimit: 0
});

// 🔍 TEST połączenia + szczegółowy log hosta i nazwy bazy
(async () => {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS db, @@hostname AS host');
    console.log('--------------------------------------------');
    console.log('✅ Połączono z MySQL!');
    console.log(`➡️  Nazwa bazy:       ${rows[0].db}`);
    console.log(`➡️  Host (serwer DB):  ${rows[0].host}`);
    console.log(`➡️  DB_HOST z .env:    ${process.env.DB_HOST}`);
    console.log('--------------------------------------------');
  } catch (err) {
    console.error('❌ Błąd połączenia z MySQL:', err);
  }
})();

module.exports = pool;
