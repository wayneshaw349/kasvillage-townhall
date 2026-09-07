// patch255_serialpost.cjs
// SRC showcase_kascity254.html -> DST showcase_kascity255.html
// Host feed: roll P3 and buy P3 recorded back-to-back; both appends fired concurrently;
// the BUY arrived at the relay before the ROLL and the follow rule refused it
// ("not_the_roller expects P2" -- the opener-seeded state). In-flight ordering is not
// guaranteed, so the tail must post ONE record at a time: no new append leaves until the
// previous one resolves. At the 1s tail cadence this costs nothing.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity254.html";
const DST = "showcase_kascity255.html";

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

// ---------- P1: one append in flight at a time ----------
rep("P1-gate-entry",
`        rec.__sent=1;
        (function(r){`,
`        if(M.__posting) break;   // __KV_V255: serialize -- arrival order must match record order
        M.__posting = 1;
        rec.__sent=1;
        (function(r){`);

// ---------- P2: release on resolve ----------
rep("P2-release-then",
  `          .then(function(o){`,
  `          .then(function(o){
            M.__posting = 0;`);

rep("P3-release-catch",
  `          .catch(function(){ r.__sent=0; log("append failed for "+r.a+" P"+r.s+" \\u2014 retrying","#e0a040"); });`,
  `          .catch(function(){ M.__posting = 0; r.__sent=0; log("append failed for "+r.a+" P"+r.s+" \\u2014 retrying","#e0a040"); });`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
if (chk.indexOf("__KV_V255: serialize") < 0) { console.error("POST-WRITE CHECK FAILED"); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
