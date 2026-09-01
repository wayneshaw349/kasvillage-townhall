// kascity_visual_v186.cjs — deterministic roll-for-first in relay games
// Three problems in the v107 dialog:
//   1. d6() uses Math.random() — each client throws different dice, so the two boards can
//      pick different first players (divergence before move zero).
//   2. `humans` is captured at load, before the DAA gun sets KV_HUMANS to this client's
//      seat — so every window rendered "(you)" against the wrong seats and waited for a tap.
//   3. tie-break rounds re-roll with the same local randomness.
// Fix: in a relay game every throw (including tie rounds) comes from KV_FIRSTROLL(seat,round),
// derived from the seed revealed with the gun, and no seat waits for a tap — the dialog just
// shows the shared result. Solo play is untouched.
const fs = require("fs");
const SRC = "showcase_kascity185.html";
const DST = "showcase_kascity186.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V186") !== -1) { console.error("ABORT: v186 already applied."); process.exit(1); }

// round-aware seeded roll
const A0 = `  window.KV_FIRSTROLL = function(seat){
    var seed = (window.KV_MP2 && window.KV_MP2.seed) || window.KV_SEED || "kv";
    var str = seed + ":first:" + seat, h = 2166136261;`;
const A1 = `  var humans=window.KV_HUMANS||[1];
  var ov=document.createElement("div");
  ov.style.cssText="position:fixed;inset:0;z-index:90;background:rgba(10,8,6,.18);`;
const A2 = `  var rolls={}, pool=[1,2,3,4], round=0;
  function d6(){ return 1+Math.floor(Math.random()*6); }`;
const A3 = `      if(humans.indexOf(s)>=0){
        render("your roll — tap to throw");`;
const A4 = `      } else {
        render("P"+s+" rolling…");
        setTimeout(function(){ rolls[s]=[d6(),d6()]; if(window.KV_MOVE) window.KV_MOVE(s,"first",rolls[s][0]+rolls[s][1]); next(); }, 550);
      }`;

for (const [n, a] of [["A0", A0], ["A1", A1], ["A2", A2], ["A3", A3], ["A4", A4]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + n + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

// A0: include the round in the derivation so tie-breaks differ but stay deterministic
s = s.replace(A0,
`  window.KV_FIRSTROLL = function(seat, round){
    var seed = (window.KV_MP2 && window.KV_MP2.seed) || window.KV_SEED || "kv";
    var str = seed + ":first:" + seat + ":" + (round||0), h = 2166136261;`);

// A1: read KV_HUMANS live rather than capturing it at load
s = s.replace(A1,
`  // __KV_V186: read live — the DAA gun sets KV_HUMANS after this block is parsed
  function humansNow(){ return window.KV_HUMANS||[1]; }
  var humans={ indexOf:function(x){ return humansNow().indexOf(x); } };
  var ov=document.createElement("div");
  ov.style.cssText="position:fixed;inset:0;z-index:90;background:rgba(10,8,6,.18);`);

// A2: relay games use the seeded throw
s = s.replace(A2,
`  var rolls={}, pool=[1,2,3,4], round=0;
  // __KV_V186: relay games derive every throw from the revealed seed
  function relay(){ return !!(window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started); }
  function throwFor(seat){
    if(relay()){ var r=window.KV_FIRSTROLL(seat, round); return [r[0], r[1]]; }
    return [1+Math.floor(Math.random()*6), 1+Math.floor(Math.random()*6)];
  }
  function d6(){ return 1+Math.floor(Math.random()*6); }`);

// A3: in a relay game nobody taps — the result is already decided by the seed
s = s.replace(A3,
`      if(!relay() && humans.indexOf(s)>=0){
        render("your roll — tap to throw");`);

// A4: both branches use throwFor
s = s.replace(A4,
`      } else {
        render(relay() ? ("P"+s+" — shared throw…") : ("P"+s+" rolling…"));
        setTimeout(function(){ rolls[s]=throwFor(s); if(window.KV_MOVE) window.KV_MOVE(s,"first",rolls[s][0]+rolls[s][1]); next(); }, relay()?350:550);
      }`);

// the tap path also uses throwFor (solo only, but keep it consistent)
s = s.replace(`        b.onclick=function(e){ e.stopPropagation(); rolls[s]=[d6(),d6()]; if(window.KV_MOVE) window.KV_MOVE(s,"first",rolls[s][0]+rolls[s][1]); next(); };`,
`        b.onclick=function(e){ e.stopPropagation(); rolls[s]=throwFor(s); if(window.KV_MOVE) window.KV_MOVE(s,"first",rolls[s][0]+rolls[s][1]); next(); };`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 5/5 — seeded throws incl. tie-breaks, live KV_HUMANS, no tap in relay games");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
