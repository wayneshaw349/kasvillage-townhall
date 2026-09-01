// kascity_visual_v187.cjs — roll-for-first must wait for the gun in relay games
// Confirmed by console: after KV.start(), KV.mp() shows started:true seat:1 roster:2, yet the
// dialog had already rendered "your roll — tap to throw". The dialog's first next() runs at
// page load, before the DAA gun sets KV_MP2.started, so relay() was false and it took the
// solo path. Fix: if a room exists but the game has not started, the dialog waits (polling)
// and only begins once started is true — at which point every throw is seed-derived.
const fs = require("fs");
const SRC = "showcase_kascity186.html";
const DST = "showcase_kascity187.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V187") !== -1) { console.error("ABORT: v187 already applied."); process.exit(1); }

const A1 = `  function next(){
    var pending=pool.filter(function(s){ return !rolls[s]; });`;

const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: next() anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`  function next(){
    // __KV_V187: in a relay game nothing is thrown until the shared start has landed —
    // the seed arrives with the gun, and every board must throw from that same seed
    if(window.KV_MP2 && window.KV_MP2.room && !window.KV_MP2.started){
      render("waiting for all players — the throw is shared");
      setTimeout(next, 700);
      return;
    }
    var pending=pool.filter(function(s){ return !rolls[s]; });`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — roll-for-first waits for the gun, then throws from the shared seed");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
