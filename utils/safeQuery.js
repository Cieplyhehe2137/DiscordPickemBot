module.exports.safeQuery = async function safeQuery(pool, sql, params = [], meta = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('safeQuery: invalid pool');
  }

  const result = pool.query(sql, params);

  // 🔥 HARD CHECK
  if (!result || typeof result.then !== 'function') {
    throw new Error('safeQuery: pool.query() is NOT a promise (mysql2/promise required)');
  }

  return await result;
};
