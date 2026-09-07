// patch270_go_kick.cjs — after stepping the engine to a non-owned seat (end branch, mid-fuse kick),
// set go=0 to provoke the roll ask (the same trigger the host bot-kicker uses), so the drain can click it.
// SRC showcase_kascity269.html -> DST showcase_kascity270.html
const fs = require("fs");
const SRC = "showcase_kascity269.html";
const DST = "showcase_kascity270.html";

let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const fails = [];
function must(a, n, label){ const c = s.split(a).length - 1; if (c !== n) fails.push(label + ": expected " + n + " found " + c); }

// A1: mid-fuse kick block (from 262)
const A1 = '    if(M.assertN===12){ try{\n' +
'      window.KV_SETSTATE("turn", m.s-1); window.KV_SETSTATE("seat", m.s);\n' +
'      window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'      window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);';

// A2: end branch stepping (from 260)
const A2 = '        if((fE.seat||1)!==nxE){\n' +
'          window.KV_SETSTATE("turn", nxE-1); window.KV_SETSTATE("seat", nxE);\n' +
'          window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",-1);';

must(A1, 1, "A1 mid-fuse kick");
must(A2, 1, "A2 end branch step");

if (fails.length) {
  console.error("ABORT — anchors:\n" + fails.join("\n"));
  process.exit(1);
}

// A1: go=0 (provoke the ask) instead of go=-1, plus a delayed second provoke
s = s.replace(A1,
'    if(M.assertN===12){ try{\n' +
'      window.KV_SETSTATE("turn", m.s-1); window.KV_SETSTATE("seat", m.s);\n' +
'      window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'      window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",0);   // __KV_V270: provoke the ask');

// A2: same for the end branch, but only when we don't own the next seat
s = s.replace(A2,
'        if((fE.seat||1)!==nxE){\n' +
'          window.KV_SETSTATE("turn", nxE-1); window.KV_SETSTATE("seat", nxE);\n' +
'          window.KV_SETSTATE("phase",0); window.KV_SETSTATE("moved",0);\n' +
'          var __goE=(nxE===M.seat || (M.owns&&M.owns(nxE))) ? -1 : 0;   // __KV_V270: provoke non-owned asks\n' +
'          window.KV_SETSTATE("asked",0); window.KV_SETSTATE("go",__goE);');

fs.writeFileSync(DST, s.replace(/\n/g, "\r\n"));
console.log("OK -> " + DST);
