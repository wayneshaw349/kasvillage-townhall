// patch308_retire_drivers.cjs — 307 made chain entries set the turn pointer directly, which makes
// the remaining drivers redundant and actively harmful: on the guest, the 285 controller kept asking
// P2 while the chain expected P1, and the 295 composer kept generating rolls that went nowhere.
//
// Retire both in relay games:
//   * the single turn controller no longer steps or asks (the chain does it)
//   * the chain-native composer no longer composes (it duplicated the engine's own turn)
//   * 294's "not responding -> pass" escape is disabled (it was firing against the wrong seat)
// The engine still runs your own seat's turn normally; everything else is rendered.
// SRC showcase_kascity307.html -> DST showcase_kascity308.html
const fs = require("fs");
const SRC = "showcase_kascity307.html";
const DST = "showcase_kascity308.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

// the controller's tick body (285) — stand it down in relay games
const A = '        if(!M.started || M.halted) return;\n' +
'        if((M.queue||[]).length){ offAt=0; return; }        // drain owns the board while replaying';
need(A, 1, "A controller tick");

// the composer's tick (295)
const B = '      var m=M(); if(!m) return;\n' +
'      if(!m.room || !m.started || m.halted) return;';
const bc = s.split(B).length - 1;

if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

// A: controller observes only
s = s.replace(A,
'        if(!M.started || M.halted) return;\n' +
'        if(window.__KV_CHAIN_RENDERS) return;   // __KV_V308: chain entries set the turn pointer\n' +
'        if((M.queue||[]).length){ offAt=0; return; }        // drain owns the board while replaying');

// B: composer stands down
if (bc >= 1) {
  s = s.split(B).join(
'      var m=M(); if(!m) return;\n' +
'      if(window.__KV_CHAIN_RENDERS) return;   // __KV_V308: the chain composes turns\n' +
'      if(!m.room || !m.started || m.halted) return;');
}

// C: the 294 escape is no longer the right instrument
const C = '          if(M.__askN>=4 && __headNow===(M.__askHead||0)){';
if (s.split(C).length - 1 === 1) {
  s = s.replace(C, '          if(false && M.__askN>=4 && __headNow===(M.__askHead||0)){   // __KV_V308: retired');
}

// the flag itself, set once the render path is live
const APPEND = `
<script>
// ---- __KV_V308: the chain renders turns; local drivers stand down ----
(function(){
  window.__KV_CHAIN_RENDERS = true;
  if (window.KV_LOG) window.KV_LOG("turn drivers retired \\u2014 the chain sets the pointer","#9cd87c");
})();
</script>
`;

s = s + APPEND;
fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
