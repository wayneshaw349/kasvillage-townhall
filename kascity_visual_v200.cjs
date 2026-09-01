// kascity_visual_v200.cjs — roll-for-first waits for the shared seed, not just `started`
// Host: P1first@11, guest: P1first@7, all other throws equal. On the host, started=true at
// KV.start() (roster) a beat before the gun sets KV_MP2.seed, so its own seat's throw used the
// fallback seed. The first-roll must not throw until the revealed seed is present.
const fs = require("fs");
const SRC = "showcase_kascity199.html";
const DST = "showcase_kascity200.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V200") !== -1) { console.error("ABORT: v200 already applied."); process.exit(1); }

const A1 = `    if(window.KV_MP2 && window.KV_MP2.room && !window.KV_MP2.started){
      render("waiting for all players — the throw is shared");
      setTimeout(next, 700);
      return;
    }`;
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: wait anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }
s = s.replace(A1,
`    if(window.KV_MP2 && window.KV_MP2.room && (!window.KV_MP2.started || !window.KV_MP2.seed)){   // __KV_V200: seed too
      render("waiting for all players — the throw is shared");
      setTimeout(next, 700);
      return;
    }`);

// also make relay() (used by throwFor) require the seed, so no path can throw seedless
const A2 = `  function relay(){ return !!(window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started); }`;
if (s.split(A2).length - 1 !== 1) { console.error("ABORT: relay() anchor not unique. File untouched."); process.exit(1); }
s = s.replace(A2, `  function relay(){ return !!(window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started && window.KV_MP2.seed); }   // __KV_V200`);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — first-roll gated on started AND seed");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
