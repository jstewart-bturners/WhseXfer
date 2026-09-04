const { app } = require("@azure/functions");
const { getPool, sql } = require("../shared/db");

// POST /api/recallManifest  Body: { manifestNo: 1001, recalledBy?: "..." }
// Moves a pallet's RDs back to InWarehouse (all-or-nothing) via usp_RecallManifest.
app.http("recallManifest", {
  methods: ["POST"], authLevel: "anonymous", route: "recallManifest",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const manifestNo = parseInt(body.manifestNo, 10);
      if (!manifestNo) return { status: 400, jsonBody: { error: "A manifest number is required." } };
      const pool = await getPool();
      const req = pool.request();
      req.input("ManifestNo", sql.Int, manifestNo);
      req.input("RecalledBy", sql.NVarChar(40), body.recalledBy || "WHSEAPP");
      const result = await req.execute("xfer.usp_RecallManifest");
      const outcome = (result.recordset && result.recordset[0]) || {};
      return { status: 200, jsonBody: outcome };
    } catch (err) {
      context.error("recallManifest failed", err);
      return { status: 500, jsonBody: { error: "Could not recall the manifest.", detail: err.message } };
    }
  }
});
