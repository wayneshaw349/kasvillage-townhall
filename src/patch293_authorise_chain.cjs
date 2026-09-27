// patch293_authorise_chain.cjs — 291's funnel blocks every turn/seat write that isn't the
// controller's, including legitimate chain-application paths: resync, the drain's step-to-mover,
// and the end-marker branch. Those ARE the chain talking, so authorise them.
// Everything else (ends-turn timer, stall detector, ROLL button flag-step, self-heal) stays blocked.
// SRC showcase_kascity292.html -> DST showcase_kascity293.html
const fs = require("fs");
const SRC = "showcase_kascity292.html";
const DST = "showcase_kascity293.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

// 1) resync's seat restore
const R = '      if(window.KV_SETSTATE && (__fNow.seat||1)!==exp){\n' +
'        window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);';
// 2) drain: step the engine to the mover (engine lagging)
const D = '        window.KV_SETSTATE("turn", m.s-1); window.KV_SETSTATE("seat", m.s);\n' +
'        window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'        window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);';
// 3) end-marker branch
const E = '          window.KV_SETSTATE("turn", nxE-1); window.KV_SETSTATE("seat", nxE);';

need(R, 1, "R resync seat restore");
need(E, 1, "E end-marker step");
const dc = s.split(D).length - 1;
if (dc < 1) fails.push("D drain step: found 0");

if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

// R
s = s.replace(R,
'      if(window.KV_SETSTATE && (__fNow.seat||1)!==exp){\n' +
'        window.__KV_CTL_WRITE=1;   // __KV_V293: the resync applies the chain\n' +
'        window.KV_SETSTATE("turn", exp-1); window.KV_SETSTATE("seat", exp);');

// close the resync authorisation after its hud_seat line
const RE = '        if(M.seat) window.KV_SETSTATE("hud_seat", M.seat);';
if (s.split(RE).length - 1 >= 1) {
  s = s.replace(RE, RE + '\n        window.__KV_CTL_WRITE=0;   // __KV_V293');
}

// D (all occurrences: the drain uses this shape more than once)
s = s.split(D).join(
'        window.__KV_CTL_WRITE=1;   // __KV_V293: applying a chain move\n' +
'        window.KV_SETSTATE("turn", m.s-1); window.KV_SETSTATE("seat", m.s);\n' +
'        window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'        window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);\n' +
'        window.__KV_CTL_WRITE=0;');

// E
s = s.replace(E,
'          window.__KV_CTL_WRITE=1;   // __KV_V293: chain end-marker\n' +
'          window.KV_SETSTATE("turn", nxE-1); window.KV_SETSTATE("seat", nxE);');
const EE = '          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);\n' +
'        }\n' +
'        M.__botAskAt={}; M.__dnudge=null;';
if (s.split(EE).length - 1 === 1) {
  s = s.replace(EE,
'          window.KV_SETSTATE("buy",-1); window.KV_SETSTATE("buy_tile",-1);\n' +
'          window.__KV_CTL_WRITE=0;   // __KV_V293\n' +
'        }\n' +
'        M.__botAskAt={}; M.__dnudge=null;');
}

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
