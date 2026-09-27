// patch315_panel_fix.cjs — baseline 313 (the build that played through), with ONLY the buy/pass
// panel corrected:
//   a) a local decision by our seat (acked or not) hides the panel — never post pass over a buy
//   b) the panel re-evaluates every tick, so BUY+price appears as soon as the tile is buyable
//      instead of being stuck on a stale early read (the host's missing-BUY bug)
// SRC showcase_kascity313.html -> DST showcase_kascity315.html
const fs = require("fs");
const SRC = "showcase_kascity313.html";
const DST = "showcase_kascity315.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

// a) closers count acked or not
const A = '    if (!lastRoll || lastRoll.s !== m.seat) return null;\n' +
'    for (var j = 0; j < mv.length; j++){\n' +
'      var q = mv[j]; if (!q || !q.__acked) continue;\n' +
'      if (q.i <= lastRoll.i) continue;\n' +
'      if (q.s === lastRoll.s && /^(buy|pass|end)$/.test(String(q.a))) return null;   // already closed\n' +
'    }\n' +
'    return lastRoll;';
need(A, 1, "A openRoll closers");

// b) shownKey short-circuit: include the buyability in the key so a change re-renders
const B = '      var pos = flags()["p" + m.seat];\n' +
'      var key = m.seat + "/" + lr.i + "/" + pos;\n' +
'      if (key === shownKey) return;\n' +
'      shownKey = key;\n' +
'      show(m.seat, pos);';
need(B, 1, "B panel key");

if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

s = s.replace(A,
'    if (!lastRoll || lastRoll.s !== m.seat) return null;\n' +
'    // __KV_V315: ANY local closer counts, acked or not \\u2014 never decide a decided turn\n' +
'    for (var j = 0; j < mv.length; j++){\n' +
'      var q = mv[j]; if (!q) continue;\n' +
'      if (q.i <= lastRoll.i) continue;\n' +
'      if (q.s === lastRoll.s && /^(buy|pass|end)$/.test(String(q.a))) return null;\n' +
'    }\n' +
'    return lastRoll;');

s = s.replace(B,
'      var pos = flags()["p" + m.seat];\n' +
'      // __KV_V315: buyability is part of the key, so the BUY button appears the moment it applies\n' +
'      var ownB = null;\n' +
'      try { ownB = (pos != null && window.KV_OWNER) ? window.KV_OWNER(pos) : null; } catch(eB){}\n' +
'      var key = m.seat + "/" + lr.i + "/" + pos + "/" + (ownB || 0);\n' +
'      if (key === shownKey) return;\n' +
'      shownKey = key;\n' +
'      show(m.seat, pos);');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
