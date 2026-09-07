// kascity_visual_v233.cjs — the sentinel band never enters the move log
// The v232 beacon echoed back through the poll, the drain adopted it at index
// 4000000102, KV_MOVES became a 4-billion-slot array and every length-based
// loop hung the tab. Three guards: (1) the drain discards any queued item in
// the sentinel band (>= 4e9) before any branch can write it; (2) the outbound
// head calculation ignores band indices so own moves never index there;
// (3) if a previous session already poisoned KV_MOVES, it is truncated once at
// startup.
const fs = require("fs");
const SRC = "showcase_kascity232.html";
const DST = "showcase_kascity233.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V233") !== -1) { console.error("ABORT: v233 already applied."); process.exit(1); }

const A1 = `    var m=M.queue[0];
    if(m.s===M.seat || M.owns(m.s)){ M.queue.shift(); return; }`;
const A2 = `              (M.queue||[]).forEach(function(q){ if(q.i > h) h = q.i; });`;
for (const [k, a] of [["A1", A1], ["A2", A2]]) {
  const c = s.split(a).length - 1;
  if (c !== 1) { console.error("ABORT: anchor " + k + " count " + c + " (expected 1). File untouched."); process.exit(1); }
}

s = s.replace(A1,
`    var m=M.queue[0];
    // __KV_V233: sentinel-band traffic (gun, beacons) never enters the move log
    if(m && (+m.i>=4000000000 || String(m.a)==="beacon" || String(m.a)==="gun")){ M.queue.shift(); return; }
    try{ var __mvl=(window.KV_MOVES||[]); if(__mvl.length>100000){ __mvl.length=1000; log("move log truncated — sentinel poisoning cleared","#e0a040"); } }catch(e){}
    if(m.s===M.seat || M.owns(m.s)){ M.queue.shift(); return; }`);

s = s.replace(A2,
`              (M.queue||[]).forEach(function(q){ if(q.i > h && q.i < 4000000000) h = q.i; });   // __KV_V233: band excluded`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — sentinel band quarantined from the move log");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
