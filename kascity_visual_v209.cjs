// kascity_visual_v209.cjs — the opening block is exempt from relay-index arithmetic
// v208's head+1 rule counted the host's published first-rolls (maxSeen) when the guest
// recorded its own copies of the opening, misnumbering the guest's record from index 0 and
// deadlocking the drain (first moves also waited for a "turn" the opening doesn't have).
// First-rolls are already synchronized by their own path (owner throws, reader replays in
// the same order), so: (1) `first` records index naturally by local length; (2) the drain
// never queues `first` moves — they are consumed on sight.
const fs = require("fs");
const SRC = "showcase_kascity208.html";
const DST = "showcase_kascity209.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V209") !== -1) { console.error("ABORT: v209 already applied."); process.exit(1); }

// 1. move(): `first` bypasses relay indexing
const A1 = `      var __mp = window.KV_MP2, __idx = window.KV_MOVES.length;
      if (__mp && __mp.room && __mp.started) {`;
// 2. drain: never queue `first`
const A2 = `          M.queue = M.queue || [];
          if(M.maxSeen == null || i > M.maxSeen) M.maxSeen = i;   // __KV_V208
          M.queue.push(m); M.queue.sort(function(a,b){ return a.i-b.i; });`;
for (const [k, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`      var __mp = window.KV_MP2, __idx = window.KV_MOVES.length;
      if (__mp && __mp.room && __mp.started && action !== "first") {   // __KV_V209: opening block indexes naturally`);

s = s.replace(A2,
`          M.queue = M.queue || [];
          if(M.maxSeen == null || i > M.maxSeen) M.maxSeen = i;   // __KV_V208
          if(m && m.a === "first"){ return; }                      // __KV_V209: opening is handled by the firstList path
          M.queue.push(m); M.queue.sort(function(a,b){ return a.i-b.i; });`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — opening exempt from relay indexing; drain skips first-rolls");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
