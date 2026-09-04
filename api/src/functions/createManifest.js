const { app } = require("@azure/functions");
const { getPool, sql } = require("../shared/db");

// POST /api/createManifest
// Body: { destination?: "335", createdBy?: "...", rds: [ {poNum,receiveDate,seqNum,locateCode}, ... ] }
// Unpacks the RD selection into the RdKeyList TVP and calls usp_CreatePalletManifest.
// Returns { header: {...}, lines: [...] } for the printable pallet document.
app.http("createManifest", {
  methods: ["POST"], authLevel: "anonymous", route: "createManifest",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const rds = Array.isArray(body.rds) ? body.rds : [];
      if (!rds.length) return { status: 400, jsonBody: { error: "No RDs supplied for the manifest." } };

      const pool = await getPool();
      const req = pool.request();

      // Build the table-valued parameter matching xfer.RdKeyList
      const tvp = new sql.Table("xfer.RdKeyList");
      tvp.columns.add("PoNum", sql.NVarChar(6));
      tvp.columns.add("ReceiveDate", sql.Date);
      tvp.columns.add("SeqNum", sql.Int);
      tvp.columns.add("LocateCode", sql.Char(2));
      for (const r of rds) {
        tvp.rows.add(r.poNum, r.receiveDate, r.seqNum, r.locateCode);
      }
      req.input("Rds", tvp);
      req.input("Destination", sql.NVarChar(20), body.destination || "335");
      req.input("CreatedBy", sql.NVarChar(40), body.createdBy || "WHSEAPP");

      const result = await req.execute("xfer.usp_CreatePalletManifest");
      // Proc returns two result sets: [0] header (1 row), [1] line detail
      const header = (result.recordsets[0] && result.recordsets[0][0]) || null;
      const lines = result.recordsets[1] || [];
      return { status: 200, jsonBody: { header, lines } };
    } catch (err) {
      context.error("createManifest failed", err);
      return { status: 500, jsonBody: { error: "Could not create the manifest.", detail: err.message } };
    }
  }
});
