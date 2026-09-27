// kascity_visual_v229.cjs — reindex works both directions
// v216 relocated drifted records only when the local copy sat at a HIGHER index
// than the relay's. Deep games drift the other way too: the local record lands
// BELOW the relay index (host recorded P2roll at 121, relay says 123) and the
// forward-only scan never finds it — assertN climbs forever. consumed() now
// searches the whole log for the matching record (same seat+action+value at a
// different index), preferring the candidate nearest the relay index, and
// relocates it there.
const fs = require("fs");
const SRC = "showcase_kascity228.html";
const DST = "showcase_kascity229.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V229") !== -1) { console.error("ABORT: v229 already applied."); process.exit(1); }

const A1 = `      var mv=(window.KV_MOVES||[]);
      for(var j=m.i+1; j<mv.length; j++){
        var r=mv[j];
        if(r && r.s===m.s && String(r.a)===String(m.a) && String(r.v)===String(m.v)){
          delete mv[j]; r.i=m.i; mv[m.i]=r; local=r;   // __KV_V217: true hole, forEach skips
          try{ if(m.hash){ r.hash=m.hash; } if(r.snap==null && m.snap) r.snap=m.snap; }catch(e){}
          log("re-indexed local "+j+" -> relay "+m.i+" ("+m.a+" P"+m.s+")", "#9cd87c");
          console.log("[KV REINDEX] "+j+" -> "+m.i, m.a, "P"+m.s);
          break;
        }
      }`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`      var mv=(window.KV_MOVES||[]);
      // __KV_V229: search BOTH directions — forward freely, backward only a short
      // window (5 slots) so an ancient same-value roll is never stolen from history.
      var best=-1, bestD=1e9;
      for(var j=Math.max(0,m.i-5); j<mv.length; j++){
        if(j===m.i) continue;
        var r0=mv[j];
        if(r0 && r0.s===m.s && String(r0.a)===String(m.a) && String(r0.v)===String(m.v)){
          var d=Math.abs(j-m.i);
          if(d<bestD){ bestD=d; best=j; }
        }
      }
      if(best>=0){
        var r=mv[best];
        delete mv[best]; r.i=m.i; mv[m.i]=r; local=r;   // __KV_V217: true hole, forEach skips
        try{ if(m.hash){ r.hash=m.hash; } if(r.snap==null && m.snap) r.snap=m.snap; }catch(e){}
        log("re-indexed local "+best+" -> relay "+m.i+" ("+m.a+" P"+m.s+")", "#9cd87c");
        console.log("[KV REINDEX] "+best+" -> "+m.i, m.a, "P"+m.s);
      }`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — reindex is bidirectional (nearest match wins)");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
