// kascity_visual_v215.cjs — the v188 verify path also halted; now it adopts
// Two callers still froze the drain after v213: verifyLater() and applyRemote()'s
// local-record compare. Update model: hash mismatch means adopt the mover's record
// (hash + snap) and keep playing; end-of-game replay judges.
const fs = require("fs");
const SRC = "showcase_kascity214.html";
const DST = "showcase_kascity215.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V215") !== -1) { console.error("ABORT: v215 already applied."); process.exit(1); }

const A1 = `    if(local && local.hash){ if(m.hash && local.hash!==m.hash) halt(m.i, m.a, m.hash, local.hash); return; }`;
const A2 = `      if(m.hash && local.hash && m.hash!==local.hash) halt(m.i, m.a, m.hash, local.hash);
      return;`;
for (const [k, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`    if(local && local.hash){
      // __KV_V215: update model — adopt the mover's record instead of halting
      if(m.hash && local.hash!==m.hash){
        try{ if(window.KV_ADOPT && m.snap) window.KV_ADOPT(m.snap); }catch(e){}
        try{ local.hash=m.hash; if(local.snap==null && m.snap) local.snap=m.snap; }catch(e){}
        log("verify mismatch at "+m.i+" ("+m.a+") — adopted mover record","#e0a040");
      }
      return; }`);

s = s.replace(A2,
`      if(m.hash && local.hash && m.hash!==local.hash){
        // __KV_V215: update model — adopt, don't halt
        try{ if(window.KV_ADOPT && m.snap) window.KV_ADOPT(m.snap); }catch(e){}
        try{ local.hash=m.hash; if(local.snap==null && m.snap) local.snap=m.snap; }catch(e){}
        log("apply mismatch at "+m.i+" ("+m.a+") — adopted mover record","#e0a040");
      }
      return;`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — v188 verify path adopts; no mid-game halts remain");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
