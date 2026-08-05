const fs = require("fs");
const f = "IOUBalanceSheetShare.tsx";
const orig = fs.readFileSync(f, "utf8");
const nl = (orig.match(/\r\n/g)||[]).length >= (orig.match(/(?<!\r)\n/g)||[]).length ? "\r\n" : "\n";
if (orig.includes("releaseOrphanIOUAllocations")) { console.error("already patched -- ABORT"); process.exit(1); }
const lines = orig.split(/\r?\n/);

// Insert after releaseBatches function (find its end: the saveBatches(batches); } after 'releaseBatches')
const ri = lines.findIndex(l => l.includes("async function releaseBatches"));
if (ri === -1) { console.error("releaseBatches not found -- ABORT"); process.exit(1); }
let ei = -1;
for (let j = ri; j < ri + 20; j++) { if (lines[j].trim() === "}") { ei = j; break; } }
if (ei === -1) { console.error("end of releaseBatches not found -- ABORT"); process.exit(1); }

const fn = [
"",
"// Free allocations whose IOU no longer exists in any active ledger (mirrors releaseOrphanCollateral).",
"export async function releaseOrphanIOUAllocations(): Promise<{ freedSompi: bigint; freedCount: number }> {",
"  const [batches, ledgers, pending] = await Promise.all([loadBatches(), loadLedgers(), loadPendingIOUs()]);",
"  const live = new Set<string>();",
"  for (const l of ledgers) for (const iou of l.ious) if (iou.status === 'pending' || iou.status === 'signed') live.add(iou.id);",
"  for (const p of pending) live.add(p.id);",
"  let freedSompi = 0n; let freedCount = 0;",
"  for (const batch of batches.values()) {",
"    const keep = [];",
"    for (const a of batch.allocations) {",
"      if (live.has(a.iouId)) { keep.push(a); }",
"      else { freedSompi += a.amountSompi; freedCount++; batch.allocatedSompi -= a.amountSompi; batch.freeSompi += a.amountSompi; }",
"    }",
"    batch.allocations = keep;",
"  }",
"  await saveBatches(batches);",
"  if (freedCount > 0) console.log('[IOU] Freed ' + freedCount + ' orphan allocations, ' + (Number(freedSompi)/1e8) + ' KAS');",
"  return { freedSompi, freedCount };",
"}"
];
lines.splice(ei + 1, 0, ...fn);
fs.writeFileSync(f + ".bak9", orig);
fs.writeFileSync(f, lines.join(nl));
console.log("added releaseOrphanIOUAllocations after line " + (ei + 1));
