// kascity_visual_v212.cjs — adopt the mover's snapshot: the update model
// The mover's snapshot IS the new state. On consuming a remote move whose snapshot differs,
// the board writes it in (cash, positions, owners) and continues — end-of-game proof/replay
// is what catches cheating, not mid-game halts. KV_ADOPT is the symmetric writer for the
// snapshot() wire format: "c1,c2,c3,c4|p1,p2,p3,p4|t1>2,t5>1,...".
const fs = require("fs");
const SRC = "showcase_kascity211.html";
const DST = "showcase_kascity212.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V212") !== -1) { console.error("ABORT: v212 already applied."); process.exit(1); }

const A1 = `window.KV_SNAPSHOT = snapshot;   // __KV_V210`;
const A2 = `            var A=String(m.snap).split("|"), B=String(ours).split("|");
            var diff=[]; for(var di=0; di<Math.max(A.length,B.length); di++){ if(A[di]!==B[di]) diff.push("["+di+"] them:"+A[di]+" us:"+B[di]); }
            log("drift after move "+m.i+" ("+m.a+" P"+m.s+"): "+diff.slice(0,4).join("  "), "#e0a040");
            console.warn("[KV DRIFT] i"+m.i, diff);`;
for (const [k, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`window.KV_SNAPSHOT = snapshot;   // __KV_V210
  // __KV_V212: symmetric writer — apply a snapshot as the board's new state
  window.KV_ADOPT = function(snap){
    try{
      var parts=String(snap||"").split("|");
      var w=window.KV_WORLD;
      var cash=(parts[0]||"").split(",").map(Number);
      var pos=(parts[1]||"").split(",").map(Number);
      for(var p=1;p<=4;p++){
        if(w && w.seats && w.seats[p-1] && isFinite(cash[p-1])) w.seats[p-1].cash = cash[p-1];
        if(window.KV_SETSTATE && isFinite(cash[p-1])) window.KV_SETSTATE("cash"+p, cash[p-1]);
        if(window.KV_SETSTATE && isFinite(pos[p-1]) && pos[p-1]>=0) window.KV_SETSTATE("p"+p, pos[p-1]);
      }
      if(w && w.owners && parts[2]!=null){
        var incoming={};
        (parts[2]?parts[2].split(","):[]).forEach(function(e){ var kv=e.split(">"); if(kv[0]) incoming[kv[0]]=parseInt(kv[1],10)||0; });
        Object.keys(w.owners).forEach(function(k){ if(!incoming[k]) delete w.owners[k]; });
        Object.keys(incoming).forEach(function(k){ w.owners[k]=incoming[k]; });
      }
      return true;
    }catch(e){ return false; }
  };`);

s = s.replace(A2,
`            var A=String(m.snap).split("|"), B=String(ours).split("|");
            var diff=[]; for(var di=0; di<Math.max(A.length,B.length); di++){ if(A[di]!==B[di]) diff.push("["+di+"] them:"+A[di]+" us:"+B[di]); }
            // __KV_V212: not a divergence — an update; the mover's state is the state
            if(window.KV_ADOPT && window.KV_ADOPT(m.snap)){
              log("state updated from P"+m.s+" after move "+m.i+(diff.length?(" ("+diff.length+" field"+(diff.length>1?"s":"")+")"):""), "#9cd87c");
            } else {
              log("update after move "+m.i+" could not be applied: "+diff.slice(0,3).join("  "), "#ff6a4a");
            }
            console.log("[KV UPDATE] i"+m.i, diff);`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — KV_ADOPT installed; remote snapshots applied as updates");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
