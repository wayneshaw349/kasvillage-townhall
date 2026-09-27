// patch254_dedupexempt.cjs
// SRC showcase_kascity253.html -> DST showcase_kascity254.html
// Feed evidence: "dedup: buy@409" followed by a 13-tick "P1 buy 18" assert loop. The
// drain's replay click made the engine generate the remote buy, but the V176 choke-point
// dedup rejected it (same seat+action+arg inside the 12-move window as the mover's own
// echo), so nothing landed at the slot, consumed() could never succeed, and the drain
// asserted until force-adopt -- freezing the pieces.
// Fix: a record generated while KV_MP2.applying matches (a remote replay) BYPASSES the
// dedup -- the relay's turn gate + slot adoption already prevent true duplicates.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity253.html";
const DST = "showcase_kascity254.html";

let raw = fs.readFileSync(SRC, "utf8");
const hadCRLF = raw.indexOf("\r\n") >= 0;
let s = hadCRLF ? raw.replace(/\r\n/g, "\n") : raw;

const errs = [];
function count(h, n){ return h.split(n).length - 1; }
function rep(label, o, n, expect){
  expect = expect == null ? 1 : expect;
  const c = count(s, o);
  if (c !== expect) { errs.push(`[${label}] anchor count ${c}, expected ${expect}`); return; }
  s = s.split(o).join(n);
}

rep("P1-dedup-exempt",
  `      if(/^(p2pbuy$|buy$|renovate$|cash:|pass$)/.test(action)){   // __KV_V225: pass dedups too`,
  `      var __replaying = !!(__mp && __mp.applying && __mp.applying.s === seat);   // __KV_V254: remote replay in flight
      if(!__replaying && /^(p2pbuy$|buy$|renovate$|cash:|pass$)/.test(action)){   // __KV_V225: pass dedups too; __KV_V254: replays exempt`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
if (chk.indexOf("__KV_V254: remote replay in flight") < 0) { console.error("POST-WRITE CHECK FAILED"); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
