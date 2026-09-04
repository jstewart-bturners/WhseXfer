# WhseXfer — Warehouse → Processing pallet manifest app (Test)

iPad-optimized SWA + Azure Functions (Node v4) over az-db-prod (South Central).
Warehouse staff select the RDs on a pallet, build a manifest (PL#), print the
pallet document (2 copies), and can recall a whole pallet by PL#.

## Structure
```
swa-index.html                 iPad UI: select-to-pallet, build, print, recall
staticwebapp.config.json
api/
  host.json, package.json      @azure/functions, mssql
  local.settings.json.example  copy to local.settings.json (git-ignored)
  src/functions/
    getPickList.js             GET  /api/pickList (InWarehouse, buyerGroup filter)
    createManifest.js          POST /api/createManifest -> usp_CreatePalletManifest (TVP)
    recallManifest.js          POST /api/recallManifest -> usp_RecallManifest
  src/shared/db.js             pooled mssql via SQL_CONN
sql/
  add_buyergroup_to_picklist.sql   RUN FIRST: adds BuyerGroups to vwPickListDetail
                                   + @BuyerGroup param to usp_GetPickList
```

## Before first run
1. Run sql/add_buyergroup_to_picklist.sql against az-db-prod.
2. whse_app grants (already in build 10_grants): EXECUTE on usp_GetPickList,
   usp_CreatePalletManifest, usp_RecallManifest + EXECUTE on TYPE xfer.RdKeyList.
3. Set SQL_CONN (whse_app credential) in the SWA environment variables.
4. Reflect the view/proc change into the master build script (07_xfer_views / 08_xfer_procs).

## SWA build config
App location: /    Api location: api    Output location: (root)

## Print
Two copies render on one print job (Pallet copy / Office copy), page-break between.
Uses window.print() with a @media print stylesheet — no library, works from a
browser to a network printer.
