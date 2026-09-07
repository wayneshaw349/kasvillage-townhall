// patch250_tracefix.cjs
// SRC showcase_kascity249.html -> DST showcase_kascity250.html
// The v162 movement trace judges pawn steps against LOCAL dice and records seat-0
// "M:P..." marker moves on mismatch. In a relay game remote pawns move by injection and
// snapshot adoption, so local dice rarely match -- the trace polluted the record
// (i26 "0M:P1 ... MISMATCH WRAP") and desynced every index after it. The stall detector
// already skips relay games (__KV_V189); the trace gets the same guard.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity249.html";
const DST = "showcase_kascity250.html";

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

rep("P1-trace-guard",
`    if (!(f.t0 > 0) || window.KV_SEALED) return;
    var dice = (f.d1 || 0) + (f.d2 || 0);`,
`    if (!(f.t0 > 0) || window.KV_SEALED) return;
    if (window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started) return;   // __KV_V250: the chain judges movement in a relay game
    var dice = (f.d1 || 0) + (f.d2 || 0);`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
if (chk.indexOf("__KV_V250: the chain judges movement") < 0) { console.error("POST-WRITE CHECK FAILED"); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
