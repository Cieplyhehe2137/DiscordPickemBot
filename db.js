// db.js
const mysql = require('mysql2/promise');
const pools = new Map();

function getPoolForGuild(guildId) {
  if (!guildId) {
    throw new Error('db.getPoolForGuild called without guildId');
  }



  if (!pools.has(guildId)) {

  console.log("ENV CHECK:", {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    name: process.env.DB_NAME
  });

  pools.set(
    guildId,
    mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    })
  );
}


  return pools.get(guildId);
}

module.exports = {
  getPoolForGuild,
};
