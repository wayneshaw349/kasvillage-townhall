// patch301_relay2_nodes.cjs — KV_RELAY2 read window.KV_NODES at load time, before the page had
// populated it, so every request went to "/undefined/...". Resolve the list lazily, with the
// known relay IPs as a fallback, and pick a node that actually answers.
// SRC showcase_kascity300.html -> DST showcase_kascity301.html
const fs = require("fs");
const SRC = "showcase_kascity300.html";
const DST = "showcase_kascity301.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function need(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

const A = '  R.NODES = (window.KV_NODES && window.KV_NODES.slice()) || [];';
const B = '  function api(path) { return (R.node || R.NODES[0]) + "/api/game/room/" + R.room + path; }';
const C = '  R.pickNode = async function () {';

need(A, 1, "A NODES init");
need(B, 1, "B api()");
need(C, 1, "C pickNode");

if (fails.length) { console.error("ABORT — anchors:\n" + fails.join("\n")); process.exit(1); }

// A: fallback list + lazy resolution
s = s.replace(A,
'  R.FALLBACK = ["http://38.240.227.139:35816","http://157.90.51.2:35816","http://65.108.72.85:35816","http://82.65.58.211:35816"];\n' +
'  R.NODES = [];\n' +
'  R.nodes = function () {\n' +
'    if (R.NODES.length) return R.NODES;\n' +
'    var live = (window.KV_NODES && window.KV_NODES.length) ? window.KV_NODES.slice() : null;\n' +
'    if (!live && window.KV_MP2 && window.KV_MP2.nodes && window.KV_MP2.nodes.length) live = window.KV_MP2.nodes.slice();\n' +
'    R.NODES = live || R.FALLBACK.slice();\n' +
'    return R.NODES;\n' +
'  };');

// B: api() resolves lazily too
s = s.replace(B,
'  function api(path) {\n' +
'    var base = R.node || R.nodes()[0];\n' +
'    return base + "/api/game/room/" + R.room + path;\n' +
'  }');

// C: pickNode uses the resolved list and verifies reachability
const PICK_OLD_START = '  R.pickNode = async function () {';
const idx = s.indexOf(PICK_OLD_START);
const endMark = '\n  };\n';
const endIdx = s.indexOf(endMark, idx);
if (idx < 0 || endIdx < 0) {
  console.error("ABORT — could not bound pickNode");
  process.exit(1);
}
const before = s.slice(0, idx);
const after = s.slice(endIdx + endMark.length);
const PICK_NEW =
'  R.pickNode = async function () {\n' +
'    var list = R.nodes();\n' +
'    for (var i = 0; i < list.length; i++) {\n' +
'      var probe = await jget(list[i] + "/api/game/room/__probe__/turn");\n' +
'      if (probe !== null) { R.node = list[i]; log("orderer: " + R.node, "#caa64c"); return R.node; }\n' +
'    }\n' +
'    R.node = list[0] || null;\n' +
'    log("no relay node answered \\u2014 using " + R.node, "#e0a040");\n' +
'    return R.node;\n' +
'  };\n';

s = before + PICK_NEW + after;

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
