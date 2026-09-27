// kascity_marker_probe.cjs — where are the seat markers drawn, and are all four handled?
const fs = require("fs");
const file = process.argv[2] || "showcase_kascity194.html";
const raw = fs.readFileSync(file, "utf8");
const lines = raw.split(/\r?\n/);

// 1) JS lines that read per-seat positions or place seat visuals
const rx = /f\["p"\+|flags\["p"\+|\["p"\+(p|s|seat)\]|\.p1\b.*\.p2\b|"p"\+i\]|seatPos|tokenPos|drawSeat|drawPiece|drawToken|placeToken|figure|sprite.*seat|seat.*sprite|COL\[(p|s|seat)\].*(x|y|left|top)/;
console.log("=== JS lines touching per-seat position/visuals (first 30) ===");
let n=0; lines.forEach((l,i)=>{ if(n<30 && rx.test(l) && !/^\s*\/\//.test(l)){ console.log((i+1)+": "+l.trim().slice(0,170)); n++; } });

// 2) scene node ids that look like seat tokens / arrows / pieces
const m = raw.match(/loadScene\("((?:[^"\\]|\\.)*)"\)/);
if (m) {
  const scene = JSON.parse(JSON.parse('"' + m[1] + '"'));
  const ids = [];
  (function w(node){ if(node==null||typeof node!=="object")return; if(Array.isArray(node)){node.forEach(w);return;} if(typeof node.id==="string" && /tok|pawn|piece|arrow|you|seat|fig|avatar|player|marker|pin/i.test(node.id)) ids.push(node.id+" ("+(node.type||"?")+")"); for(const k of Object.keys(node)) w(node[k]); })(scene.nodes||scene);
  console.log("\n=== scene node ids that look like seat markers ===");
  console.log(ids.slice(0,60).join("\n") || "(none matched)");
  // 3) engine actions that move a node based on p2
  const hits=[];
  (function w(node,path){ if(node==null||typeof node!=="object")return; if(Array.isArray(node)){node.forEach((x,i)=>w(x,path.concat(i)));return;} if(node.do && typeof node.do.action==="string" && JSON.stringify(node.do).indexOf("flags.p2")>=0) hits.push(node.do.action+" -> "+JSON.stringify(node.do).slice(0,160)); for(const k of Object.keys(node)) w(node[k],path.concat(k)); })(scene,[]);
  console.log("\n=== engine actions referencing flags.p2 (first 12) ===");
  console.log(hits.slice(0,12).join("\n") || "(none)");
}
