// fix_release_guard.cjs — client-side guard on RELEASE STALE LOCKS.
//
// The release calls releaseOrphanCollateral([]) / releaseOrphanIOUs([]) with an
// EMPTY live-id list, i.e. "assume nothing is live" — which frees every ledger
// entry, including funds reserved for a real, in-flight obligation. Fine when
// the ledger is only carrying leftovers; dangerous if an agreement is running.
//
// This patch makes the button ask the live source first:
//   listActiveAgreements()  -> non-terminal agreements (step != complete/aborted)
// and pass THEIR ids as the live list, so:
//   * stale entries (no matching live agreement) are still freed
//   * entries backing a live agreement are KEPT
//   * if any live agreement exists, the button says so and refuses the blanket
//     IOU sweep, since a live IOU id list isn't available device-side.
// Run from layer1 root:  node src\fix_release_guard.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("listActiveAgreements")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("release-guard",
`        try {
          const led = require('./utxo_ledger');
          const c = await led.releaseOrphanCollateral([]);
          const i = await led.releaseOrphanIOUs([]);
          const lt = await led.getLockedTotals();
          gadd('released ' + c + ' collateral + ' + i + ' IOU orphan entries; locks now ' + (Number(lt.total) / 1e8) + ' KAS');
        } catch (e: any) { gadd('release failed: ' + String(e?.message || e)); }`,
`        try {
          const led = require('./utxo_ledger');
          const { listActiveAgreements } = require('./local_agreements');
          const live = await listActiveAgreements();
          const liveIds = live.map((a: any) => a.agrId).filter(Boolean);
          if (live.length > 0) {
            gadd('GUARD: ' + live.length + ' live agreement(s) — keeping their locks:');
            live.forEach((a: any) => gadd('  ' + String(a.agrId).slice(0, 16) + '  step=' + a.step));
          }
          const c = await led.releaseOrphanCollateral(liveIds);
          let i = 0;
          if (live.length === 0) {
            i = await led.releaseOrphanIOUs([]);
          } else {
            gadd('GUARD: IOU sweep SKIPPED (live agreements present — settle them first)');
          }
          const lt = await led.getLockedTotals();
          gadd('released ' + c + ' collateral + ' + i + ' IOU orphan entries; locks now ' + (Number(lt.total) / 1e8) + ' KAS');
        } catch (e: any) { gadd('release failed: ' + String(e?.message || e)); }`, 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). The button now preserves locks backing live agreements.");
