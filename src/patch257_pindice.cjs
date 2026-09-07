// patch257_pindice.cjs
// SRC showcase_kascity256.html -> DST showcase_kascity257.html
// PINNED DICE -- the structural fix. When the drain replays a remote roll, it stages the
// chain's value; diceRoll() consumes the pin at entry, overriding the local RNG draw.
// The pawn therefore walks exactly where the chain says, consumed() matches on the first
// try (v equal), and the force-adopt/position-drift class dies at the root.
//   P1: diceRoll(seat,a,b) -- if __KV_PIN[seat] staged, decompose the pinned total into
//       a+b (clamped 1..6 each) and use it; pin is one-shot.
//   P2: the drain's roll-assert path stages the pin for NON-OWNED seats only (own and
//       host-bot originals keep real RNG -- they are the source of truth).
//   P3: resync clears stale pins.
// Count-guarded, CRLF-safe, abort-before-write.

const fs = require("fs");
const SRC = "showcase_kascity256.html";
const DST = "showcase_kascity257.html";

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

// ---------- P1: consume the pin at diceRoll entry ----------
rep("P1-dice-pin",
`  function diceRoll(seat, a, b){`,
`  function diceRoll(seat, a, b){
    // __KV_V257: pinned dice -- an injected remote roll uses the chain's value
    try{
      var __pin = window.__KV_PIN && window.__KV_PIN[seat];
      if(__pin != null){
        delete window.__KV_PIN[seat];
        var __t = Math.max(2, Math.min(12, Math.round(+__pin)||2));
        a = Math.max(1, Math.min(6, Math.ceil(__t/2)));
        b = __t - a;
        if(b < 1){ b = 1; a = __t - 1; }
        if(b > 6){ b = 6; a = __t - 6; }
      }
    }catch(eP){}`);

// ---------- P2: drain stages the pin for non-owned seats ----------
rep("P2-stage-pin",
  '      var fits = (a==="roll") ? /Tap to roll/.test(txt) : /buy|pass|deed|block/i.test(txt);',
`      var fits = (a==="roll") ? /Tap to roll/.test(txt) : /buy|pass|deed|block/i.test(txt);
      if(a==="roll" && !(m.s===M.seat || M.owns(m.s))){   // __KV_V257: replayed roll -- pin the chain's dice
        window.__KV_PIN = window.__KV_PIN || {};
        window.__KV_PIN[m.s] = +m.v;
      }`);

// ---------- P3: resync clears stale pins ----------
rep("P3-clear-pins",
  "      M.queue = [];",
`      M.queue = [];
      window.__KV_PIN = {};   // __KV_V257`);

if (errs.length) {
  console.error("ABORT -- nothing written:");
  errs.forEach(function(e){ console.error("  " + e); });
  process.exit(1);
}

let out = hadCRLF ? s.replace(/\n/g, "\r\n") : s;
fs.writeFileSync(DST, out, "utf8");
const chk = fs.readFileSync(DST, "utf8");
const must = ["__KV_V257: pinned dice", "__KV_V257: replayed roll"];
const missing = must.filter(function(x){ return chk.indexOf(x) < 0; });
if (missing.length) { console.error("POST-WRITE CHECK FAILED", missing); process.exit(1); }
console.log("OK -> " + DST + "  (" + chk.length + " chars)");
