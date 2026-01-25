async function safeQuery(pool, sql, params = [], meta = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('safeQuery: invalid pool object');
  }

  const result = pool.query(sql, params);

  // 🔥 HARD ASSERT — to zabije błąd na starcie
  if (!result || typeof result.then !== 'function') {
    throw new Error(
      'safeQuery: pool.query() is NOT a Promise. ' +
      'Use mysql2/promise pool ONLY.'
    );
  }

  try {
    return await result;
  } catch (err) {
    // opcjonalne logowanie
    if (meta?.scope) {
      console.error('[DB ERROR]', meta.scope, err.message);
    }
    throw err;
  }
}

module.exports = { safeQuery };
