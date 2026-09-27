// patch251_fluxauthority.cjs
// SRC showcase_kascity250.html -> DST showcase_kascity251.html
// Rule: flux is the authority. Tiered response to mismatches --
//   - ordinary adopt-on-mismatch keeps converging via mover-record adoption (cheap, stays)
//   - FORCE-ADOPT (the drain gave up replaying a move) is proof of real divergence:
//     fuse cut 75 ticks (~30s) -> 25 (~10s), and it now fires an IMMEDIATE full resync
//     from the chain (throttle bypassed), instead of waiting for the 2-strike detector.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity250.html";
const DST = "showcase_kascity251.html";

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

rep("P1-forceadopt",
`    if(M.assertN>75){
      // __KV_V219: force-adopt instead of dropping \u2014 the mover's record is the record
      try{
        var mv=(window.KV_MOVES||[]);
        if(!mv[m.i]){ mv[m.i]={ i:m.i, s:m.s, a:m.a, v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null }; }
        if(window.KV_ADOPT && m.snap) window.KV_ADOPT(m.snap);
        log("relay move "+m.i+" ("+m.a+" P"+m.s+") not consumed after 30s \u2014 force-adopted","#e0a040");
        console.warn("[KV FORCE-ADOPT] i"+m.i, m.a, "P"+m.s);
      }catch(e){}
      M.queue.shift(); M.assertN=0; }`,
`    if(M.assertN>25){
      // __KV_V251: the drain gave up = proven divergence; flux is the authority
      try{
        var mv=(window.KV_MOVES||[]);
        if(!mv[m.i]){ mv[m.i]={ i:m.i, s:m.s, a:m.a, v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null, fx:m.fx||null }; }
        if(window.KV_ADOPT && m.snap) window.KV_ADOPT(m.snap);
        log("relay move "+m.i+" ("+m.a+" P"+m.s+") not consumed after 10s \u2014 force-adopted, reverting to the chain","#e0a040");
        console.warn("[KV FORCE-ADOPT] i"+m.i, m.a, "P"+m.s);
        if(M.resync){ M.__lastResync=0; M.resync("force-adopt at i"+m.i); }
      }catch(e){}
      M.queue.shift(); M.assertN=0; }`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V251: the drain gave up = proven divergence", "reverting to the chain", "M.assertN>25"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
