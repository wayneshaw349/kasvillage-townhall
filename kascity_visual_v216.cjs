// kascity_visual_v216.cjs — relay index wins: relocate drifted local records
// Guest replays a remote move; the engine's derived effects (p2pbuy, cash, buy)
// get recorded at fresh LOCAL indices while the relay carries the mover's indices.
// consumed() only checked local[m.i], so the same logical move sat at i16 locally
// vs i8 on the wire — never consumed, queue deadlocked. Now: if local[m.i] is empty
// or different, scan forward for a record with the same seat+action+value at a
// HIGHER index, relocate it to m.i (relay position), adopt hash/snap, consume.
const fs = require("fs");
const SRC = "showcase_kascity215.html";
const DST = "showcase_kascity216.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V216") !== -1) { console.error("ABORT: v216 already applied."); process.exit(1); }

const A1 = `  function consumed(m){
    var local=(window.KV_MOVES||[])[m.i];
    if(!local || local.i!==m.i) return false;`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`  function consumed(m){
    var local=(window.KV_MOVES||[])[m.i];
    // __KV_V216: relay index is the only ordering — if our copy of this move drifted
    // to a higher local index, relocate it to the relay position and consume.
    if((!local || local.i!==m.i || local.s!==m.s || String(local.a)!==String(m.a))){
      var mv=(window.KV_MOVES||[]);
      for(var j=m.i+1; j<mv.length; j++){
        var r=mv[j];
        if(r && r.s===m.s && String(r.a)===String(m.a) && String(r.v)===String(m.v)){
          mv[j]=undefined; r.i=m.i; mv[m.i]=r; local=r;
          try{ if(m.hash){ r.hash=m.hash; } if(r.snap==null && m.snap) r.snap=m.snap; }catch(e){}
          log("re-indexed local "+j+" -> relay "+m.i+" ("+m.a+" P"+m.s+")", "#9cd87c");
          console.log("[KV REINDEX] "+j+" -> "+m.i, m.a, "P"+m.s);
          break;
        }
      }
    }
    if(!local || local.i!==m.i) return false;`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — drifted local records relocate to the relay index");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
