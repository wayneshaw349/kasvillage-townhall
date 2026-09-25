// fix_ts_errors.cjs — the 5 pre-existing tsc errors (2 files). CRLF-safe, idempotent.
// Run from the layer1 root:  node src\fix_ts_errors.cjs
//
// avatar_arweave_upload.ts: lamportAttest is declared with `export async function`
//   AND re-listed in the export{} block -> duplicate export. Fix: drop it from the
//   export{} list (the declaration keeps exporting it; call sites unaffected).
// wallet_merkle_archive.ts:
//   - fetchTipBlockHeader takes 'mainnet' | 'testnet' but is passed 'testnet-10'
//     -> pass 'testnet' (line 137 shows the fn normalizes internally anyway).
//   - blockAnchor?.daaScore: CapturedBlockHeader names it daa_score -> use daa_score.
const fs = require("fs");
let n = 0;
function patch(file, edits) {
  let s = fs.readFileSync(file, "utf8");
  const CRLF = s.includes("\r\n");
  if (CRLF) s = s.replace(/\r\n/g, "\n");
  for (const [name, from, to, expected] of edits) {
    const found = s.split(from).length - 1;
    if (found === 0 && s.includes(to)) { console.log("skip[" + name + "]: already fixed"); continue; }
    if (found !== expected) { console.error("ABORT [" + name + "]: expected " + expected + ", found " + found); process.exit(1); }
    s = s.split(from).join(to); n++; console.log("ok  [" + name + "]");
  }
  fs.writeFileSync(file, CRLF ? s.replace(/\n/g, "\r\n") : s);
}

patch("avatar_arweave_upload.ts", [
  ["dup-lamport-export",
   "  uploadToIrys,\n  lamportAttest,\n  ARWEAVE_GATEWAY,",
   "  uploadToIrys,\n  // lamportAttest is exported at its declaration (line ~404)\n  ARWEAVE_GATEWAY,", 1],
]);

patch("wallet_merkle_archive.ts", [
  ["tip-network-literal",
   "fetchTipBlockHeader(params.network === 'mainnet' ? 'mainnet' : 'testnet-10')",
   "fetchTipBlockHeader(params.network === 'mainnet' ? 'mainnet' : 'testnet')", 1],
  ["daa-field-name",
   "daaScore: blockAnchor?.daaScore || params.daaScore,",
   "daaScore: blockAnchor?.daa_score || params.daaScore,", 1],
]);

console.log("\ndone (" + n + " fixes). re-run the tsc line to confirm 0 errors.");
