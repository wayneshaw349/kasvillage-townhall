// kascity_visual_v221.cjs — pass must be a move
// Rolls and buys reach the record via observable state changes (position, owner).
// A pass changes nothing observable, so it produced no record, nothing relayed,
// and the peer's engine waited at the buy/pass prompt (phase 21) forever — the
// "freezes after a buy/offer" bug. Now the dialogue click itself records
// pass for the acting seat when this device owns it; the relay carries it and
// the peer's drain answers the hidden prompt (choice 1) as already wired in v206.
const fs = require("fs");
const SRC = "showcase_kascity220.html";
const DST = "showcase_kascity221.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V221") !== -1) { console.error("ABORT: v221 already applied."); process.exit(1); }

const A1 = `  dlgEl.onclick = function (e) {
    var idx = e.target && e.target.getAttribute ? e.target.getAttribute("data-i") : null;
    advanceDialogue(idx === null ? 0 : parseInt(idx, 10));
  };`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1,
`  dlgEl.onclick = function (e) {
    var idx = e.target && e.target.getAttribute ? e.target.getAttribute("data-i") : null;
    var __i = idx === null ? 0 : parseInt(idx, 10);
    // __KV_V221: a pass is invisible to the state watchers — record it here so the
    // relay can carry it and the peer's pending prompt gets answered.
    try {
      var __mp = window.KV_MP2;
      if (__mp && __mp.room && __mp.started && __i === 1) {
        var __seat = (world && world.flags && world.flags.seat) || 1;
        var __own = (__seat === __mp.seat) || (__mp.owns && __mp.owns(__seat));
        if (__own && /buy|pass|deed|block/i.test(String(node.text || "")) && window.KV_MOVE) {
          var __pos = (world && world.flags && world.flags["p" + __seat]) || 0;
          window.KV_MOVE(__seat, "pass", __pos);
        }
      }
    } catch (e2) {}
    advanceDialogue(__i);
  };`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — passes are recorded and relayed");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
