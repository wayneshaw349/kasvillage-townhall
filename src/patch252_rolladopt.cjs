// patch252_rolladopt.cjs
// SRC showcase_kascity251.html -> DST showcase_kascity252.html
// Root cause of the force-adopt storms: injected remote rolls make the local engine draw
// ITS OWN dice (the shared-seed RNG streams have drifted), so the local record's value
// differs from the chain's -- and consumed()'s relocation requires an exact value match,
// so the replay is never consumed.
//   P1: relocation matches rolls on seat+action alone and ADOPTS the mover's value
//       (their dice are the dice; the snapshot already corrects the position).
//   P2: force-adopt fuse 25 ticks (~10s) -> 40 (~16s) -- opening-phase injection lag was
//       tripping it prematurely; the immediate revert-to-chain resync stays.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity251.html";
const DST = "showcase_kascity252.html";

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

// ---------- P1: value-tolerant roll relocation + value adoption ----------
rep("P1-relocate-match",
  `        if(r0 && r0.s===m.s && String(r0.a)===String(m.a) && String(r0.v)===String(m.v)){`,
  `        if(r0 && r0.s===m.s && String(r0.a)===String(m.a) && (String(r0.v)===String(m.v) || String(m.a)==="roll")){   // __KV_V252: the mover's dice are the dice`);

rep("P1-relocate-adopt",
  `        delete mv[best]; r.i=m.i; mv[m.i]=r; local=r;   // __KV_V217: true hole, forEach skips`,
  `        delete mv[best]; r.i=m.i; mv[m.i]=r; local=r;   // __KV_V217: true hole, forEach skips
        if(String(r.v)!==String(m.v)){ r.v=m.v; }        // __KV_V252: adopt the chain's value`);

// P1b: the direct-slot check also tolerates a drifted roll value implicitly (it never
// compared v), but the record keeps the local value -- align it during hash adoption:
rep("P1b-direct-adopt",
`      try{ if(window.KV_ADOPT && m.snap) window.KV_ADOPT(m.snap); }catch(e){}
      try{ local.hash=m.hash; if(local.snap==null && m.snap) local.snap=m.snap; }catch(e){}
      log("hash mismatch at "+m.i+" ("+m.a+") \u2014 adopted mover record", "#e0a040");`,
`      try{ if(window.KV_ADOPT && m.snap) window.KV_ADOPT(m.snap); }catch(e){}
      try{ local.hash=m.hash; if(local.snap==null && m.snap) local.snap=m.snap;
        if(String(local.v)!==String(m.v)) local.v=m.v; }catch(e){}   // __KV_V252
      log("hash mismatch at "+m.i+" ("+m.a+") \u2014 adopted mover record", "#e0a040");`);

// ---------- P2: fuse 25 -> 40 ----------
rep("P2-fuse",
  "    if(M.assertN>25){",
  "    if(M.assertN>40){   // __KV_V252: ~16s; opening-phase lag no longer trips it");

rep("P2-fuse-log",
  `        log("relay move "+m.i+" ("+m.a+" P"+m.s+") not consumed after 10s \u2014 force-adopted, reverting to the chain","#e0a040");`,
  `        log("relay move "+m.i+" ("+m.a+" P"+m.s+") not consumed after 16s \u2014 force-adopted, reverting to the chain","#e0a040");`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V252: the mover's dice are the dice", "__KV_V252: adopt the chain's value", "M.assertN>40"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
