// kascity_visual_v220.cjs — the prompt gate covers every dialogue, not just rolls
// P3's buy/pass prompt showed on BOTH boards: the v199 gate only matched "Tap to
// roll". Now any choice dialogue whose engine seat isn't this device's own seat is
// hidden. If this device owns that seat as a bot (host), the prompt is answered
// automatically (choice 0) so the behavior tree doesn't stall; if it's a remote
// human's, it stays pending until their move arrives through the relay.
const fs = require("fs");
const SRC = "showcase_kascity219.html";
const DST = "showcase_kascity220.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V220") !== -1) { console.error("ABORT: v220 already applied."); process.exit(1); }

const A1 = `  try {   // __KV_V199
    var __mp = window.KV_MP2;
    if (__mp && __mp.room && __mp.started && __mp.seat > 0 && !window.__KV_UNLOCK) {
      var __seat = (world && world.flags && world.flags.seat) || 1;
      var __isRoll = /Tap to roll/.test(String(node.text || ""));
      if (__isRoll && __seat !== __mp.seat) { dlgEl.style.display = "none"; return; }
    }
  } catch (e) {}`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`  try {   // __KV_V199 -> __KV_V220: gate EVERY choice dialogue by seat ownership
    var __mp = window.KV_MP2;
    if (__mp && __mp.room && __mp.started && __mp.seat > 0 && !window.__KV_UNLOCK) {
      var __seat = (world && world.flags && world.flags.seat) || 1;
      var __hasChoices = !!(node.choices && node.choices.length);
      if (__hasChoices && __seat !== __mp.seat) {
        dlgEl.style.display = "none";
        var __owned = false;
        try { __owned = !!(__mp.owns && __mp.owns(__seat)); } catch (e) {}
        if (__owned) {
          // my bot: answer silently so the tree keeps moving (roll/buy default)
          setTimeout(function(){ try { advanceDialogue(0); } catch (e) {} }, 80);
        }
        return;
      }
    }
  } catch (e) {}`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — all choice prompts gated by seat ownership");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
