// patch261_court_chain.cjs — holding/court judged per-owned-seat in relay games, published on the chain
// - movement trace no longer fully skipped in relay: owned seats are judged, non-owned skipped
// - M:P marker writes + MOVE MISMATCH shout stay solo-only (chain judges movement in relay)
// - caught owned seat publishes "court" move; remotes shout/log + adopt snap
// SRC showcase_kascity260.html -> DST showcase_kascity261.html
const fs = require("fs");
const SRC = "showcase_kascity260.html";
const DST = "showcase_kascity261.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A1 = "if (window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started) return;";
const A2 = "      var from = last[p], to = cur; last[p] = cur;";
const A3 = "if (to !== expect && window.KV_MOVE) window.KV_MOVE(0, line.slice(0, 70), to);";
const A4 = "if (to !== expect && !holding && window.KV_SHOUT) {";
const A5 = 'if (window.KV_LOG) window.KV_LOG("P" + p + " caught: " + crime + " \\u2014 sent to the Holding Cell, fined 50", "#ff4a3a");';
const A6 = "    // __KV_V233: effect payloads";
const F1 = 'follow:["buy","pass","end"]';
const F2 = 'follow: ["buy","pass","end"]';

must(A1, 1, "A1 v250 relay skip");
must(A2, 1, "A2 from/to update");
must(A3, 1, "A3 marker write");
must(A4, 1, "A4 mismatch shout");
must(A5, 1, "A5 caught log");
must(A6, 1, "A6 applyRemote fx comment");
const f1c = s.split(F1).length - 1, f2c = s.split(F2).length - 1;
if (f1c + f2c < 2) fails.push("A7 follow list: found " + (f1c + f2c) + " (expected 2+)");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// A1: relay flag instead of full skip
s = s.replace(A1, "var __relay = !!(window.KV_MP2 && window.KV_MP2.room && window.KV_MP2.started);   // __KV_V261: judge only owned seats in a relay game");

// A2: skip non-owned seats in relay (positions are adopted, not generated)
s = s.replace(A2, A2 + "\n" +
"      if (__relay) { var __mp2=window.KV_MP2; if(!(p===__mp2.seat || (__mp2.owns&&__mp2.owns(p)))) continue; }");

// A3/A4: marker writes + mismatch shout stay solo-only
s = s.replace(A3, "if (!__relay && to !== expect && window.KV_MOVE) window.KV_MOVE(0, line.slice(0, 70), to);");
s = s.replace(A4, "if (!__relay && to !== expect && !holding && window.KV_SHOUT) {");

// A5: publish court on the chain when an owned seat is caught
s = s.replace(A5, A5 + "\n" +
'        if (__relay && window.KV_MOVE) window.KV_MOVE(p, "court", 50);   // __KV_V261: tell the chain');

// A6: applyRemote handles remote "court" — visual + snap adopt; state lands via snapshot
s = s.replace(A6,
'    // __KV_V261: remote court — announce, adopt the mover\'s snapshot, mark consumed\n' +
'    if(a==="court"){\n' +
'      try{\n' +
'        var mvC=(window.KV_MOVES||[]);\n' +
'        if(!mvC[m.i]) mvC[m.i]={ i:m.i, s:m.s, a:"court", v:m.v, t:m.t, hash:m.hash||null, snap:m.snap||null, fx:m.fx||null, __sent:1, __acked:1 };\n' +
'        if(window.KV_SHOUT) window.KV_SHOUT("CAUGHT \\u2014 SENT TO HOLDING", "P"+m.s+" \\u00b7 fined 50 \\u00b7 turn ends", "#ff4a3a", false);\n' +
'        log("P"+m.s+" sent to the Holding Cell (chain)", "#ff4a3a");\n' +
'        if(m.snap && window.KV_ADOPT) window.KV_ADOPT(m.snap);\n' +
'      }catch(eC){}\n' +
'      un(); return;\n' +
'    }\n' +
A6);

// A7: relay gate follow list += court
if (f1c) s = s.split(F1).join('follow:["buy","pass","end","court"]');
if (f2c) s = s.split(F2).join('follow: ["buy","pass","end","court"]');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
