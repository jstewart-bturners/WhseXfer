// Shared SQL connection pool. Reads SQL_CONN from env (whse_app credential,
// stored in the SWA environment variables / Keeper). Never in source.
const sql = require("mssql");
let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    const cs = process.env.SQL_CONN;
    if (!cs) throw new Error("SQL_CONN is not set.");
    poolPromise = sql.connect(cs).catch(err => { poolPromise = null; throw err; });
  }
  return poolPromise;
}
module.exports = { getPool, sql };
