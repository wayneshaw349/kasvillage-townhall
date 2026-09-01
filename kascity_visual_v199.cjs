// kascity_visual_v199.cjs — narrow the v198 gate: only the Roll prompt is owner-only
// v198 hid every dialogue for "seats not in KV_HUMANS" and over-suppressed (no Roll for
// anyone). Now: in a relay game, the "Your turn. Tap to roll" prompt is hidden only when
// the seat on turn != KV_MP2.seat. Everything else (renovate, offers, scenarios) stays
// live on both boards. KV.unlock() disables the gate for the session if ever needed.
const fs = require("fs");
const SRC = "showcase_kascity198.html";
const DST = "showcase_kascity199.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V199") !== -1) { console.error("ABORT: v199 already applied."); process.exit(1); }

const A1 = `  try {
    var __mp = window.KV_MP2;
    if (__mp && __mp.room && __mp.started) {
      var __seat = (world && world.flags && world.flags.seat) || 1;
      if ((window.KV_HUMANS || [1]).indexOf(__seat) < 0) { dlgEl.style.display = "none"; return; }
    }
  } catch (e) {}
  dlgEl.style.display = "block";`;
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: v198 gate anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }
s = s.replace(A1,
`  try {   // __KV_V199
    var __mp = window.KV_MP2;
    if (__mp && __mp.room && __mp.started && __mp.seat > 0 && !window.__KV_UNLOCK) {
      var __seat = (world && world.flags && world.flags.seat) || 1;
      var __isRoll = /Tap to roll/.test(String(node.text || ""));
      if (__isRoll && __seat !== __mp.seat) { dlgEl.style.display = "none"; return; }
    }
  } catch (e) {}
  dlgEl.style.display = "block";`);

// remove the v198 watchdog (it matched too broadly)
const A2s = `    // __KV_V198: remote seat -> no local dialogue, ever
    setInterval(function(){`;
const A2e = `    }, 150);`;
const i0 = s.indexOf(A2s);
if (i0 < 0) { console.error("ABORT: v198 watchdog start not found. File untouched."); process.exit(1); }
const i1 = s.indexOf(A2e, i0);
if (i1 < 0) { console.error("ABORT: v198 watchdog end not found. File untouched."); process.exit(1); }
s = s.slice(0, i0) + `    // __KV_V199: v198 watchdog removed; escape hatch below
    window.KV.unlock=function(){ window.__KV_UNLOCK=true; console.log("relay prompt gate disabled for this session"); };` + s.slice(i1 + A2e.length);

fs.writeFileSync(DST, s);
console.log("PASS anchors 2/2 — Roll prompt owner-only (by KV_MP2.seat); other prompts live; KV.unlock() added");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
