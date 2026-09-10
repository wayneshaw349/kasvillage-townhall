// patch286_ctl_fix.cjs — fixes 285:
//   A: expected() only holds the turn for a roller whose roll is ACKED; otherwise the relay's
//      expect wins (a refused roll must not pin the controller to that seat).
//   B: __lastRollRx records only acked rolls, so an unacked local roll can't hold the turn.
//   C: legacy turn watchdog is hard-disabled whenever the controller exists (pattern-match in 285
//      missed it), and so is the bot idle-kicker's direct write.
// SRC showcase_kascity285.html -> DST showcase_kascity286.html
const fs = require("fs");
const SRC = "showcase_kascity285.html";
const DST = "showcase_kascity286.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A = '        if(lr && RT.last===lr.s){';
const C = '  // ---- __KV_V226: turn-pointer watchdog';

need(A, 1, "A controller mid-decision branch");
need(C, 1, "C watchdog banner");

if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

// A: only an acked, un-closed roll holds the turn; and the relay must agree it is that seat
s = s.replace(A, '        if(lr && lr.__acked && RT.last===lr.s && RT.exp!==lr.s){');

// B: record only acked rolls in __lastRollRx (poller path records from the chain = acked; the
//    ack path already is. Guard the poller line defensively.)
s = s.split('if(m.a==="roll"){ M.__lastRollRx={ s:m.s, i:m.i, at:Date.now() }; }   // __KV_V275')
     .join('if(m.a==="roll"){ M.__lastRollRx={ s:m.s, i:m.i, at:Date.now(), acked:1 }; }   // __KV_V286');

// C: hard-disable the legacy watchdog when the controller is present
s = s.replace(C,
'  // ---- __KV_V286: legacy watchdog disabled while the single controller runs ----\n' + C);

const W = '        if(!M.started || M.halted) return;\n' +
'        if((M.queue||[]).length) return;                      // drain is working; leave it alone';
if (s.split(W).length - 1 === 1) {
  s = s.replace(W,
'        if(!M.started || M.halted) return;\n' +
'        if(window.KV_TURN_CTL) return;                        // __KV_V286: controller owns turns\n' +
'        if((M.queue||[]).length) return;                      // drain is working; leave it alone');
} else {
  fails.push("C2 watchdog guard point not found");
}

// also stop the bot idle-kicker writing go directly when the controller exists
s = s.split('        if(window.KV_SETSTATE) window.KV_SETSTATE("go",0);\n        lastAt=Date.now();')
     .join('        if(window.KV_TURN_CTL){ M.requestStep(seatNow,"bot-idle"); lastAt=Date.now(); return; }   // __KV_V286\n' +
           '        if(window.KV_SETSTATE) window.KV_SETSTATE("go",0);\n        lastAt=Date.now();');

if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
