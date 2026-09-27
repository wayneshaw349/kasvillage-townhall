// fix_publish_daa.cjs — the panel ADVERTISES the walk coordinates.
//
// After a publish, the slot addresses' UTXOs carry blockDaaScore per chunk tx
// (live index, trustless). The panel reads them and extends the launch data:
//   { game, manifestAddress, manifestHash, head, daa_from, daa_to }
// daa_from/daa_to = min/max chunk DAA (with a small margin). A client-side
// mini-indexer then walks: pruning_point --(txs=0 fast-forward)--> daa_from
// --(txs=1 collect)--> daa_to, matching txids from the same UTXO set.
// Run from layer1 root:  node src\fix_publish_daa.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("daa_from")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("daa-span-triple",
`      const t = JSON.stringify({ game: gameId, manifestAddress, manifestHash: res.manifestHash, head: m.head });`,
`      let daaSpan: { daa_from?: number; daa_to?: number } = {};
      try {
        let lo = Number.MAX_SAFE_INTEGER, hi = 0;
        for (const sa of slotAddresses.concat([manifestAddress])) {
          const ur = await fetch('https://api-tn10.kaspa.org/addresses/' + encodeURIComponent(sa) + '/utxos');
          for (const u of (await ur.json()) || []) {
            const d = Number(u.utxoEntry?.blockDaaScore || u.blockDaaScore || 0);
            if (d > 0) { if (d < lo) lo = d; if (d > hi) hi = d; }
          }
        }
        if (hi > 0) daaSpan = { daa_from: Math.max(0, lo - 600), daa_to: hi + 600 }; // ±1 min margin
        gadd('walk span: daa ' + daaSpan.daa_from + ' .. ' + daaSpan.daa_to);
      } catch (de: any) { gadd('daa span skipped: ' + String(de?.message || de)); }
      const t = JSON.stringify({ game: gameId, manifestAddress, manifestHash: res.manifestHash, head: m.head, ...daaSpan });`, 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). Launch data now carries daa_from/daa_to.");
