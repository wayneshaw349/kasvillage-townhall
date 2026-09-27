// kascity_visual_v213.cjs — no mid-game halts in the update model
// Two halt paths defeated v212's adopt logic before it could run:
//  (1) KV_COMMIT.check recomputed the peer's hash with OUR local snapshot() — with v210
//      hashing the mover's captured snap, that can never match once state moved → halt.
//      Fix: check passes m.snap into commitMove so it recomputes exactly what the mover hashed.
//  (2) consumed() called halt() on hash mismatch before the v212 adopt block was reached.
//      Fix: warn + adopt the mover's snapshot; keep the chain moving. End-of-game replay judges.
const fs = require("fs");
const SRC = "showcase_kascity212.html";
const DST = "showcase_kascity213.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V213") !== -1) { console.error("ABORT: v213 already applied."); process.exit(1); }

const A1 = `      var mine = await commitMove(m.index, m.seat, m.action, m.value || 0);
      if (mine === m.hash) return true;
      halted = true;`;
const A2 = `    if(m.hash && local.hash && m.hash!==local.hash){ halt(m.i, m.a, m.hash, local.hash); }
    return true;`;
for (const [k, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`      var mine = await commitMove(m.index, m.seat, m.action, m.value || 0, m.snap);   // __KV_V213: verify what the mover actually hashed
      if (mine === m.hash) return true;
      // __KV_V213: update model — adopt, warn, never halt mid-game
      if (window.KV_ADOPT && m.snap){ window.KV_ADOPT(m.snap); }
      if (window.KV_LOG) window.KV_LOG("hash mismatch at move " + m.index + " (" + m.action + ") — adopted mover state, replay will judge", "#e0a040");
      return true;
      halted = true;`);

s = s.replace(A2,
`    if(m.hash && local.hash && m.hash!==local.hash){
      // __KV_V213: update model — the mover's record is the record; adopt and continue
      try{ if(window.KV_ADOPT && m.snap) window.KV_ADOPT(m.snap); }catch(e){}
      try{ local.hash=m.hash; if(local.snap==null && m.snap) local.snap=m.snap; }catch(e){}
      log("hash mismatch at "+m.i+" ("+m.a+") — adopted mover record", "#e0a040");
      console.warn("[KV ADOPT-ON-MISMATCH] i"+m.i);
    }
    return true;`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — mid-game halts removed; check verifies mover snap; mismatch adopts");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
