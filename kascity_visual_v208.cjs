// kascity_visual_v208.cjs — the relay index is the only move ordering
// Drift cause: each board numbered moves at its own local length, so the same move sat at
// different indices on different boards (relay i14 = guest local i12) and the queue's
// index-matching deadlocked.
// Now:
//  1. While the drain loop applies remote move m (M.applying=m), the engine's local record
//     of that action ADOPTS m.i — the boards agree on where every remote move sits.
//  2. Own moves are indexed at head+1, where head = highest index known from local record,
//     pending queue, and everything seen from the relay — not the local array length.
//  3. If the relay answers stored:false for our index (someone else won it), the record is
//     re-indexed to the new head+1 and re-posted (loud log; hash cleared so the peer applies
//     by position, not stale hash).
const fs = require("fs");
const SRC = "showcase_kascity207.html";
const DST = "showcase_kascity208.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V208") !== -1) { console.error("ABORT: v208 already applied."); process.exit(1); }

// --- A1: move() index assignment (the choke point) ---
const A1 = `var rec={i:window.KV_MOVES.length, s:seat, a:action, v:arg, t:left};`;
// --- A2: drain loop sets/clears M.applying around applyRemote ---
const A2 = `    M.assertN=(M.assertN||0)+1;
    if(M.assertN===1 || M.assertN%3===0) applyRemote(m);                 // re-assert every ~1.2s`;
// --- A3: outbound send handles stored:false ---
const A3 = `        (function(r){
          fan("/api/game/room/"+M.room+"/move", { wallet:wallet(),
            move:{ i:r.i, s:r.s, a:String(r.a), v:r.v, t:r.t, hash:r.hash } }, true)
          .catch(function(){ delete sent[r.i]; log("move "+r.i+" not relayed — retrying","#e0a040"); });
        })(rec);`;
// --- A4: track highest seen relay index in poll ---
const A4 = `          M.queue = M.queue || [];
          M.queue.push(m); M.queue.sort(function(a,b){ return a.i-b.i; });`;

for (const [k, a] of [["A1", A1], ["A2", A2], ["A3", A3], ["A4", A4]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`// __KV_V208: relay games index by the shared log, not local length
      var __mp = window.KV_MP2, __idx = window.KV_MOVES.length;
      if (__mp && __mp.room && __mp.started) {
        if (__mp.applying && __mp.applying.s === seat && String(__mp.applying.a) === String(action)) {
          __idx = __mp.applying.i;                       // recording a remote move: adopt its relay index
        } else {
          var __h = window.KV_MOVES.length - 1;
          if (__mp.maxSeen != null && __mp.maxSeen > __h) __h = __mp.maxSeen;
          (__mp.queue || []).forEach(function(q){ if (q.i > __h) __h = q.i; });
          __idx = __h + 1;                               // own move: next slot after everything known
        }
      }
      var rec={i:__idx, s:seat, a:action, v:arg, t:left};`);

s = s.replace(A2,
`    M.assertN=(M.assertN||0)+1;
    if(M.assertN===1 || M.assertN%3===0){ M.applying=m; applyRemote(m); setTimeout(function(){ if(M.applying===m) M.applying=null; }, 1200); }   // __KV_V208`);

s = s.replace(A3,
`        (function(r){
          fan("/api/game/room/"+M.room+"/move", { wallet:wallet(),
            move:{ i:r.i, s:r.s, a:String(r.a), v:r.v, t:r.t, hash:r.hash } }, true)
          .then(function(oks){
            // __KV_V208: if no node stored it at that index, someone else owns the slot — re-index and repost
            var won = oks.some(function(o){ return o && o.stored; });
            if(!won){
              var h = (window.KV_MOVES||[]).length - 1;
              if(M.maxSeen != null && M.maxSeen > h) h = M.maxSeen;
              (M.queue||[]).forEach(function(q){ if(q.i > h) h = q.i; });
              log("index "+r.i+" taken — re-posting "+r.a+" at "+(h+1), "#e0a040");
              delete sent[r.i];
              r.i = h + 1; r.hash = null;
            }
          })
          .catch(function(){ delete sent[r.i]; log("move "+r.i+" not relayed — retrying","#e0a040"); });
        })(rec);`);

s = s.replace(A4,
`          M.queue = M.queue || [];
          if(M.maxSeen == null || i > M.maxSeen) M.maxSeen = i;   // __KV_V208
          M.queue.push(m); M.queue.sort(function(a,b){ return a.i-b.i; });`);

// KV_MOVES may now be sparse in index terms; store at slot i so lookups by index stay valid
const A5 = `window.KV_MOVES.push(rec);`;
if (s.split(A5).length - 1 !== 1) { console.error("ABORT: push anchor not unique. File untouched."); process.exit(1); }
s = s.replace(A5, `if(rec.i === window.KV_MOVES.length) window.KV_MOVES.push(rec); else window.KV_MOVES[rec.i] = rec;   // __KV_V208: slot = relay index`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 5/5 — relay-index ordering: adoption on apply, head+1 for own moves, collision repost");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
