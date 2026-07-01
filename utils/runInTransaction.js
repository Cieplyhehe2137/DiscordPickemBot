// utils/runInTransaction.js
//
// Wraps the getConnection/beginTransaction/commit/rollback/release
// boilerplate that was copy-pasted across the results-submission handlers.

async function runInTransaction(pool, fn) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { runInTransaction };
