// fix_publish_reserve.cjs — two additions to the PUBLISH CHAIN GAMES panel:
//
// 1. PRE-FLIGHT line before publishing: prints the owner address, its live
//    REST balance, and the utxo_ledger locked totals (collateral / IOU /
//    per-entry ids) — so a stale lock is visible instead of a mystery.
// 2. "?? RELEASE STALE LOCKS" button: calls releaseOrphanCollateral([]) and
//    releaseOrphanIOUs([]) — the ledger's OWN orphan-cleanup with an empty
//    live-id list, which frees every entry whose agreement/IOU no longer
//    exists. Safe: live agreements re-anchor on their next sync, and the
//    wallet's Financial Summary (0 collateral / 0 IOUs) is the truth here.
//
// Root cause this addresses: getLockedTotals() found 15 KAS in the local
// utxo_ledger store (device-side) while the summary shows 0 — a leftover
// commitment from earlier agreement/IOU testing that never got released.
// The balance-floor guard in kaspa_rest_tx.ts then compared it against the
// wallet's VISIBLE UTXOs mid-publish (change from chunk txs not yet indexed)
// and refused. With the stale lock cleared, floor = 0 and the guard skips.
//
// Run from layer1 root:  node src\fix_publish_reserve.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("RELEASE STALE LOCKS")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}

// 1. pre-flight inside runPublish, right after owner keys resolve
rep("preflight",
`      const owner = { privateKeyHex: priv, pubkeyHex: pub, address: myAddr, network: 'testnet-10' as any };
      const m = entry.bundle.manifest;`,
`      const owner = { privateKeyHex: priv, pubkeyHex: pub, address: myAddr, network: 'testnet-10' as any };
      try {
        const led = require('./utxo_ledger');
        const lt = await led.getLockedTotals();
        gadd('owner ' + myAddr);
        const ur = await fetch('https://api-tn10.kaspa.org/addresses/' + encodeURIComponent(myAddr) + '/utxos');
        const uj = await ur.json();
        const tot = (Array.isArray(uj) ? uj : []).reduce((a: bigint, u: any) => a + BigInt(u.utxoEntry?.amount || u.amount || '0'), 0n);
        gadd('visible UTXOs ' + (Number(tot) / 1e8).toFixed(4) + ' KAS in ' + (Array.isArray(uj) ? uj.length : 0) + ' coins');
        gadd('ledger locks: collateral ' + (Number(lt.collateral) / 1e8) + ' + IOU ' + (Number(lt.iou) / 1e8) + ' = ' + (Number(lt.total) / 1e8) + ' KAS');
        if (lt.total > 0n) gadd('?? locks > 0 while summary shows 0 -> press RELEASE STALE LOCKS first');
      } catch (pf: any) { gadd('preflight warn: ' + String(pf?.message || pf)); }
      const m = entry.bundle.manifest;`, 1);

// 2. release button next to the game buttons
rep("release-button",
`      {Object.entries(GAMES).map(([id, e]: any) => (`,
`      <TouchableOpacity disabled={!!gbusy} onPress={async () => {
        try {
          const led = require('./utxo_ledger');
          const c = await led.releaseOrphanCollateral([]);
          const i = await led.releaseOrphanIOUs([]);
          const lt = await led.getLockedTotals();
          gadd('released ' + c + ' collateral + ' + i + ' IOU orphan entries; locks now ' + (Number(lt.total) / 1e8) + ' KAS');
        } catch (e: any) { gadd('release failed: ' + String(e?.message || e)); }
      }} style={{ backgroundColor: '#1d2a18', borderWidth: 1, borderColor: '#3f5a34', borderRadius: 8, padding: 8, alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ color: '#9fd98a', fontFamily: 'monospace', fontSize: 11 }}>?? RELEASE STALE LOCKS (ledger cleanup)</Text>
      </TouchableOpacity>
      {Object.entries(GAMES).map(([id, e]: any) => (`, 1);

fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). Reload app -> panel -> RELEASE STALE LOCKS -> PUBLISH.");
