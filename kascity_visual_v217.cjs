// kascity_visual_v217.cjs — the reindex left a hole that crashed iterators
// v216 relocated a drifted record with mv[j]=undefined; Array#forEach still visits
// an assigned-undefined slot, so any loop reading .a threw (282x), killing the
// watcher/outbound loops — guest stopped receiving NPC moves. delete mv[j] makes
// a true hole that forEach skips.
const fs = require("fs");
const SRC = "showcase_kascity216.html";
const DST = "showcase_kascity217.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V217") !== -1) { console.error("ABORT: v217 already applied."); process.exit(1); }

const A1 = `          mv[j]=undefined; r.i=m.i; mv[m.i]=r; local=r;`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1, `          delete mv[j]; r.i=m.i; mv[m.i]=r; local=r;   // __KV_V217: true hole, forEach skips`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — relocated slots are true holes; iterators safe");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
