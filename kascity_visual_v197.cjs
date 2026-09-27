// kascity_visual_v197.cjs — the gun resets the engine clock on every client
// Observed: host clock -3 (expired) with only first-rolls; guest clock 358 and playing.
// The engine's 7:00 countdown starts on the first pointer tap — the lobby's "Host a game"
// click counts — so the host's clock ran out during the wait for the join. Both boards
// must count down from the same DAA moment: on GO, reset t0/left/mark/over.
const fs = require("fs");
const SRC = "showcase_kascity196.html";
const DST = "showcase_kascity197.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V197") !== -1) { console.error("ABORT: v197 already applied."); process.exit(1); }

const A1 = `      log("GO — "+n+" players, seat P"+(M.seat||1)+", DAA "+startDaa, "#9cd87c");`;
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error("ABORT: GO anchor count " + c1 + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`      log("GO — "+n+" players, seat P"+(M.seat||1)+", DAA "+startDaa, "#9cd87c");
      // __KV_V197: every board's 7:00 starts here, at the gun — not at whoever tapped the lobby first
      try{
        var __w = window.KV_WORLD;
        if(window.KV_SETSTATE){
          window.KV_SETSTATE("over", 0);
          window.KV_SETSTATE("t0", (__w && __w.time) ? __w.time : 0.01);
          window.KV_SETSTATE("left", 420);
          window.KV_SETSTATE("mark", 420);
        }
        window.KV_SEALED = false;
        log("clock reset to 7:00 at DAA "+startDaa, "#caa64c");
      }catch(e){}`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — engine clock reset at the gun on every client");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
