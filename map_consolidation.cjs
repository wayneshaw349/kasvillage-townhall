const fs = require("fs");
console.log("=== utxo_ledger.ts — IOU + tag surface ===");
const u = fs.readFileSync("utxo_ledger.ts","utf8").split(/\r?\n/);
u.forEach((l,i)=>{ if(/export (async )?function|allocateForIOU|releaseIOU|iou-allocated|canonical|utxoKey|commitReason|canSpend|getBalanceBreakdown/.test(l)) console.log("LEDGER:"+(i+1)+": "+l.trim().slice(0,120)); });
console.log("");
console.log("=== IOUBalanceSheetShare.tsx — batch surface (to replace) ===");
const b = fs.readFileSync("IOUBalanceSheetShare.tsx","utf8").split(/\r?\n/);
b.forEach((l,i)=>{ if(/kv_sompi_batches|syncBatches|allocateBatches|releaseBatches|loadBatches|saveBatches|SompiBatch|freeSompi|allocatedSompi|releaseOrphanIOU/.test(l)) console.log("IOU:"+(i+1)+": "+l.trim().slice(0,120)); });
