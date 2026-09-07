// kascity_visual_v211.cjs — the snapshot travels with the move; receivers reconcile
// Wayne's ring model: mover takes a snapshot, it rides with the move; the next board accepts
// and reconciles before proceeding. This patch: (1) outbound moves include rec.snap;
// (2) when the drain marks a remote move consumed, the local snapshot is diffed against the
// mover's, field by field (cash / positions / owners), and any drift is logged precisely.
const fs = require("fs");
const SRC = "showcase_kascity210.html";
const DST = "showcase_kascity211.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V211") !== -1) { console.error("ABORT: v211 already applied."); process.exit(1); }

const A1 = `            move:{ i:r.i, s:r.s, a:String(r.a), v:r.v, t:r.t, hash:r.hash } }, true)`;
const A2 = `    if(consumed(m)){ M.queue.shift(); M.assertN=0; return; }`;
for (const [k, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`            move:{ i:r.i, s:r.s, a:String(r.a), v:r.v, t:r.t, hash:r.hash, snap:r.snap||null } }, true)   /* __KV_V211 */`);

s = s.replace(A2,
`    if(consumed(m)){
      // __KV_V211: reconcile against the mover's snapshot — name the drift, don't just halt
      try{
        if(m.snap && window.KV_SNAPSHOT){
          var ours=window.KV_SNAPSHOT();
          if(ours!==m.snap){
            var A=String(m.snap).split("|"), B=String(ours).split("|");
            var diff=[]; for(var di=0; di<Math.max(A.length,B.length); di++){ if(A[di]!==B[di]) diff.push("["+di+"] them:"+A[di]+" us:"+B[di]); }
            log("drift after move "+m.i+" ("+m.a+" P"+m.s+"): "+diff.slice(0,4).join("  "), "#e0a040");
            console.warn("[KV DRIFT] i"+m.i, diff);
          }
        }
      }catch(e){}
      M.queue.shift(); M.assertN=0; return;
    }`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — snapshots ride with moves; consumption reconciles and names drift");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
