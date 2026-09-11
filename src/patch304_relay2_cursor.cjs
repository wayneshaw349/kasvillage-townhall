// patch304_relay2_cursor.cjs — two bugs in KV_RELAY2's start-up:
//   1) the poll cursor used the relay's head, so entries the client had not ingested were skipped
//      forever (head:4 but only entry 0 in the log). Track the ingest cursor separately.
//   2) postFirsts sat behind the tick's early return, so it never ran.
// SRC showcase_kascity303.html -> DST showcase_kascity304.html
const fs = require("fs");
const SRC = "showcase_kascity303.html";
const DST = "showcase_kascity304.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A = '  R.poll = async function () {\n' +
'    if (!R.room) return;\n' +
'    var lg = await jget(api("/log?after=" + R.head));';
const B = '    if (lg.head != null) R.head = Math.max(R.head, lg.head);';
const C = '      R.log[e.i] = e;\n' +
'      R.head = Math.max(R.head, e.i + 1);\n' +
'      R.ingest(e);';

need(A, 1, "A poll head cursor");
need(B, 1, "B head assignment");
need(C, 1, "C ingest loop");

if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

// separate cursor: what we have ingested, not what the relay reports
s = s.replace(A,
'  R.cursor = 0;            // __KV_V304: entries ingested so far (the /log ?after= value)\n' +
'  R.poll = async function () {\n' +
'    if (!R.room) return;\n' +
'    var lg = await jget(api("/log?after=" + R.cursor));');

s = s.replace(C,
'      R.log[e.i] = e;\n' +
'      R.cursor = Math.max(R.cursor, e.i + 1);\n' +
'      R.head = Math.max(R.head, e.i + 1);\n' +
'      R.ingest(e);');

// the relay's head is informational only
s = s.replace(B,
'    if (lg.head != null) R.head = Math.max(R.head, lg.head);   // relay total, not a cursor');

// the post path must not advance the cursor either
const D = '      } else if (o && o.i != null) {\n' +
'        R.head = Math.max(R.head, o.i + 1);\n' +
'      }';
if (s.split(D).length - 1 === 1) {
  s = s.replace(D,
'      } else if (o && o.i != null) {\n' +
'        R.head = Math.max(R.head, o.i + 1);   // __KV_V304: cursor advances only on ingest\n' +
'      }');
}

// make the start-up path unconditional in the tick
const T = '        if (R.gun && !R.openStarted) { R.postFirsts(); R.maybeOpen(); return; }';
if (s.split(T).length - 1 === 1) {
  s = s.replace(T,
'        if (R.gun && !R.openStarted) { R.postFirsts(); R.maybeOpen(); return; }   // __KV_V304');
} else {
  // 303 may not have applied its tick edit; add the call defensively
  const T2 = '        if (R.left() <= 0) { R.finish(false); return; }\n        R.act();';
  if (s.split(T2).length - 1 === 1) {
    s = s.replace(T2,
'        if (R.gun && !R.openStarted) { R.postFirsts(); R.maybeOpen(); return; }   // __KV_V304\n' +
'        if (R.left() <= 0) { R.finish(false); return; }\n        R.act();');
  }
}

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
