// patch302_probe_fix.cjs — the node probe used jget(), which returns null on any non-200. The
// relay answers /room/__probe__/turn with 404 {"error":"no such room"} — a reachable node. So every
// node looked dead and R.node was never set. Probe on reachability (any HTTP response) instead.
// SRC showcase_kascity301.html -> DST showcase_kascity302.html
const fs = require("fs");
const SRC = "showcase_kascity301.html";
const DST = "showcase_kascity302.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

const A = '  R.pickNode = async function () {\n' +
'    var list = R.nodes();\n' +
'    for (var i = 0; i < list.length; i++) {\n' +
'      var probe = await jget(list[i] + "/api/game/room/__probe__/turn");\n' +
'      if (probe !== null) { R.node = list[i]; log("orderer: " + R.node, "#caa64c"); return R.node; }\n' +
'    }\n' +
'    R.node = list[0] || null;\n' +
'    log("no relay node answered \\u2014 using " + R.node, "#e0a040");\n' +
'    return R.node;\n' +
'  };';

const c = s.split(A).length - 1;
if (c !== 1) {
  console.error("ABORT — anchor found " + c + " times (expected 1)");
  process.exit(1);
}

s = s.replace(A,
'  R.reachable = async function (base) {\n' +
'    var c = new AbortController();\n' +
'    var t = setTimeout(function () { c.abort(); }, 5000);\n' +
'    try {\n' +
'      // any HTTP response proves the node is up; 404 "no such room" is expected here\n' +
'      await fetch(base + "/api/game/room/__probe__/turn", { signal: c.signal });\n' +
'      clearTimeout(t); return true;\n' +
'    } catch (e) { clearTimeout(t); return false; }\n' +
'  };\n' +
'  R.pickNode = async function () {\n' +
'    var list = R.nodes();\n' +
'    for (var i = 0; i < list.length; i++) {\n' +
'      if (await R.reachable(list[i])) { R.node = list[i]; log("orderer: " + R.node, "#caa64c"); return R.node; }\n' +
'    }\n' +
'    R.node = list[0] || null;\n' +
'    log("no relay node answered \\u2014 using " + R.node, "#e0a040");\n' +
'    return R.node;\n' +
'  };');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
