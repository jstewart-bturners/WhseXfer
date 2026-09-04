const { app } = require("@azure/functions");
const { getPool, sql } = require("../shared/db");

// POST /api/createManifest
// Body: { destination?, createdBy?, rds: [ {poNum,receiveDate,seqNum,locateCode}, ... ] }
// Calls usp_CreatePalletManifest (TVP). Proc returns header result set + line-detail result set.
// We identify the sets by CONTENT (header has ManifestNo/ManifestLabel; lines have PO) so we
// aren't dependent on result-set ordering, which can shift with row-count messages, etc.
app.http("createManifest", {
  methods: ["POST"], authLevel: "anonymous", route: "createManifest",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const rds = Array.isArray(body.rds) ? body.rds : [];
      if (!rds.length) return { status: 400, jsonBody: { error: "No RDs supplied for the manifest." } };

      const pool = await getPool();
      const req = pool.request();
      const tvp = new sql.Table("xfer.RdKeyList");
      tvp.columns.add("PoNum", sql.NVarChar(6));
      tvp.columns.add("ReceiveDate", sql.Date);
      tvp.columns.add("SeqNum", sql.Int);
      tvp.columns.add("LocateCode", sql.Char(2));
      for (const r of rds) tvp.rows.add(r.poNum, r.receiveDate, r.seqNum, r.locateCode);
      req.input("Rds", tvp);
      req.input("Destination", sql.NVarChar(20), body.destination || "335");
      req.input("CreatedBy", sql.NVarChar(40), body.createdBy || "WHSEAPP");

      const result = await req.execute("xfer.usp_CreatePalletManifest");
      const sets = result.recordsets || [];

      // header set = the one whose first row has ManifestLabel/ManifestNo
      let header = null, lines = [];
      for (const set of sets) {
        if (!set || !set.length) continue;
        const first = set[0];
        if (header === null && (first.ManifestLabel !== undefined || first.ManifestNo !== undefined) && first.PO === undefined) {
          header = first;
        } else if (first.PO !== undefined || first.Vendor !== undefined) {
          lines = set;
        }
      }
      // fallback to positional if content-detection missed
      if (header === null && sets[0] && sets[0][0]) header = sets[0][0];
      if (lines.length === 0 && sets[1]) lines = sets[1];

      context.log(`createManifest: ${sets.length} result set(s); header=${!!header}; lines=${lines.length}`);
      return { status: 200, jsonBody: { header, lines } };
    } catch (err) {
      context.error("createManifest failed", err);
      return { status: 500, jsonBody: { error: "Could not create the manifest.", detail: err.message } };
    }
  }
});
