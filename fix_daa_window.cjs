// fix_daa_window.cjs - keep the advertised DAA span to the publish, not the address.
//
// Observed in a real publish:
//   [Workspace] store coords {"daa_from":541297355,"daa_to":582168740,...}
// That is 40.8 MILLION daa wide - about 470 days. Store and dapp addresses are
// deterministic per host, so re-publishing reuses the address and the UTXO scan
// picks up chunks from every previous publish. The oldest UTXO set daa_from.
//
// A walk over 470 days is worse than crawling from the pruning point, so the
// coordinates were being advertised in a form no client could act on.
//
// Fix: a publish takes minutes, never days. Clamp the window to the last 14400
// daa (~4 h) before the newest chunk. Applied to all four sites - both game
// paths as well, which have the same exposure whenever an address is reused.
//
// pledge_kas deliberately still totals ALL utxos at the address: the bond
// accumulating across re-presses is intended behaviour, unlike the span.
// Run from layer1 root:  node src\\fix_daa_window.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("hi - 14400")) { console.log("already patched"); process.exit(0); }
const n = s.split("daa_from: Math.max(0, lo - 600)").length - 1;
if (n !== 4) { console.error("ABORT: found " + n + " span sites, expected 4"); process.exit(1); }
s = s.split("daa_from: Math.max(0, lo - 600)").join("daa_from: Math.max(0, Math.max(lo, hi - 14400) - 600)");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("ok  [daa-window] 4 sites clamped to a 4h publish window");
console.log("\npatched " + P + ". Advertised spans are now walkable.");
