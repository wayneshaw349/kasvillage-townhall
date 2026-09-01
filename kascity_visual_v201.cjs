// kascity_visual_v201.cjs — host-authoritative opening through the relay
// The host throws roll-for-first for all four seats (and tie rounds) and publishes each as a
// `first` move. The guest never throws: its dialog waits for the host's values from the relay
// and records them verbatim, so both boards open identically without depending on seed timing.
const fs = require("fs");
const SRC = "showcase_kascity200.html";
const DST = "showcase_kascity201.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V201") !== -1) { console.error("ABORT: v201 already applied."); process.exit(1); }

// 1. outbound: host also publishes every `first` record (all seats)
const A1 = `        if(!rec || sent[rec.i] || !mine(rec.s)) continue;`;
// 2. poll: capture first-rolls from the relay per seat, in order
const A2 = `          if(M.seen[i]) return; M.seen[i]=1;
          var m=by[i];`;
// 3. roll-for-first bot/auto branch: guest waits for the host's value
const A3 = `      } else {
        render(relay() ? ("P"+s+" — shared throw…") : ("P"+s+" rolling…"));
        setTimeout(function(){ rolls[s]=throwFor(s); if(window.KV_MOVE) window.KV_MOVE(s,"first",rolls[s][0]+rolls[s][1]); next(); }, relay()?350:550);
      }`;
for (const [n, a] of [["A1", A1], ["A2", A2], ["A3", A3]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`        if(!rec || sent[rec.i]) continue;
        if(!(mine(rec.s) || (rec.a==="first" && M.role==="host"))) continue;   // __KV_V201: host publishes the opening`);

s = s.replace(A2,
`          if(M.seen[i]) return; M.seen[i]=1;
          var m=by[i];
          if(m && m.a==="first" && m.s>=1 && m.s<=4){ M.firstList=M.firstList||{}; (M.firstList[m.s]=M.firstList[m.s]||[]).push(Number(m.v)); }   // __KV_V201`);

s = s.replace(A3,
`      } else {
        // __KV_V201: the guest does not throw — it takes the host's value from the relay
        if(relay() && window.KV_MP2.role!=="host"){
          var __L=(window.KV_MP2.firstList||{})[s]||[], __v=__L[round];
          if(__v==null){ render("P"+s+" — waiting for the host's throw…"); setTimeout(next, 500); return; }
          render("P"+s+" — from the host…");
          setTimeout(function(){ var a=Math.max(1,Math.min(6,Math.ceil(__v/2))), b=Math.max(1,Math.min(6,__v-a)); rolls[s]=[a,b]; if(window.KV_MOVE) window.KV_MOVE(s,"first",__v); next(); }, 250);
          return;
        }
        render(relay() ? ("P"+s+" — shared throw…") : ("P"+s+" rolling…"));
        setTimeout(function(){ rolls[s]=throwFor(s); if(window.KV_MOVE) window.KV_MOVE(s,"first",rolls[s][0]+rolls[s][1]); next(); }, relay()?350:550);
      }`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 3/3 — host publishes all first-rolls; guest reads them from the relay");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
