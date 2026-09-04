const { app } = require("@azure/functions");
const { getPool, sql } = require("../shared/db");

// GET /api/pickList — warehouse candidates to build onto a pallet.
// Defaults to InWarehouse. Supports store, buyer, buyerGroup, receivedSince filters.
app.http("getPickList", {
  methods: ["GET"], authLevel: "anonymous", route: "pickList",
  handler: async (request, context) => {
    try {
      const q = request.query;
      const pool = await getPool();
      const req = pool.request();
      req.input("Store", sql.Char(2), q.get("store") || null);
      req.input("Buyer", sql.NVarChar(40), q.get("buyer") || null);
      req.input("State", sql.VarChar(20), q.get("state") || "InWarehouse");
      req.input("ReceivedSince", sql.Date, q.get("receivedSince") || null);
      req.input("IncludeUninventoried", sql.Bit, 0);
      req.input("BuyerGroup", sql.NVarChar(40), q.get("buyerGroup") || null);
      const result = await req.execute("xfer.usp_GetPickList");
      return { status: 200, jsonBody: { rows: result.recordset || [] } };
    } catch (err) {
      context.error("getPickList failed", err);
      return { status: 500, jsonBody: { error: "Could not load the pick list.", detail: err.message } };
    }
  }
});
