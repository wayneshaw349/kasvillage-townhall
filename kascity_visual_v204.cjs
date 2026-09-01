// kascity_visual_v204.cjs — ordered apply queue: re-assert each relayed input until consumed
// Observed: host never applied P2's roll (relay had idx 4-5, host local stopped at 3). The
// one-shot go=0 can be wiped by the engine's own prompt (which sets go=-1) if it fires after.
// Now: remote moves go into a queue ordered by index. The head is applied and re-asserted
// every 400ms until the local record holds that index with the same seat+action (hash checked),
// then the next index is applied. Nothing is applied out of order.
const fs = require("fs");
const SRC = "showcase_kascity203.html";
const DST = "showcase_kascity204.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V204") !== -1) { console.error("ABORT: v204 already applied."); process.exit(1); }

// replace the merge->applyRemote loop in poll with enqueue; add the drain loop
const A1 = `        Object.keys(by).map(Number).sort(function(a,b){return a-b;}).forEach(function(i){
          if(M.seen[i]) return; M.seen[i]=1;
          var m=by[i];
          if(m && m.a==="first" && m.s>=1 && m.s<=4){ M.firstList=M.firstList||{}; (M.firstList[m.s]=M.firstList[m.s]||[]).push(Number(m.v)); }   // __KV_V201
          // __KV_V184: the gun rides at a sentinel index and never joins the move record
          if(i===4000000000 || (m && m.a==="gun")){
            if(m) M.armGun(Number(m.v), m.seed||null, m.players||M.roster.length);
            return;
          }
          applyRemote(m);
        });`;
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: poll-apply anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`        Object.keys(by).map(Number).sort(function(a,b){return a-b;}).forEach(function(i){
          if(M.seen[i]) return; M.seen[i]=1;
          var m=by[i];
          if(m && m.a==="first" && m.s>=1 && m.s<=4){ M.firstList=M.firstList||{}; (M.firstList[m.s]=M.firstList[m.s]||[]).push(Number(m.v)); }   // __KV_V201
          if(i===4000000000 || (m && m.a==="gun")){
            if(m) M.armGun(Number(m.v), m.seed||null, m.players||M.roster.length);
            return;
          }
          // __KV_V204: queue in index order; the drain loop applies and re-asserts until consumed
          M.queue = M.queue || [];
          M.queue.push(m); M.queue.sort(function(a,b){ return a.i-b.i; });
        });`);

// drain loop: install next to the poll interval
const A2 = `  setInterval(poll, 1000);`;
if (s.split(A2).length - 1 !== 1) { console.error("ABORT: poll interval anchor not unique. File untouched."); process.exit(1); }
s = s.replace(A2,
`  setInterval(poll, 1000);

  // __KV_V204: ordered drain — apply the head, keep re-asserting until the engine records it
  M.queue = M.queue || [];
  function consumed(m){
    var local=(window.KV_MOVES||[])[m.i];
    if(!local || local.i!==m.i) return false;
    if(local.s!==m.s || String(local.a)!==String(m.a)) return false;
    if(m.hash && local.hash && m.hash!==local.hash){ halt(m.i, m.a, m.hash, local.hash); }
    return true;
  }
  setInterval(function(){
    if(!M.started || M.halted || !M.queue.length) return;
    var m=M.queue[0];
    if(m.s===M.seat || M.owns(m.s)){ M.queue.shift(); return; }        // my own or my bots: I produced it
    if(consumed(m)){ M.queue.shift(); M.assertN=0; return; }
    // only apply when the engine is on that seat's turn (or the move is a non-turn event)
    var f=(window.KV_FLAGS&&window.KV_FLAGS())||{};
    var turnBound=/^(roll|buy|pass|first)$/.test(String(m.a));
    if(turnBound && (f.seat||1)!==m.s){ return; }                        // wait for the engine to reach that seat
    M.assertN=(M.assertN||0)+1;
    if(M.assertN===1 || M.assertN%3===0) applyRemote(m);                 // re-assert every ~1.2s
    if(M.assertN>75){ log("relay move "+m.i+" ("+m.a+" P"+m.s+") not consumed after 30s — skipping","#ff6a4a"); M.queue.shift(); M.assertN=0; }
  }, 400);`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — ordered apply queue with re-assert until consumed");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
