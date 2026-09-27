// kascity_visual_v225.cjs — pass joins the choke-point dedup
// v221 records a pass at the dialogue click, but every matching dialog click
// recorded another one ("P2 pass 25" x5): the dedup window at the choke point
// covered p2pbuy/buy/renovate/cash but not pass. One pass per seat+position per
// 12-move window is the rule now.
const fs = require("fs");
const SRC = "showcase_kascity224.html";
const DST = "showcase_kascity225.html";
let s = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");

if (s.indexOf("__KV_V225") !== -1) { console.error("ABORT: v225 already applied."); process.exit(1); }

const A1 = `if(/^(p2pbuy$|buy$|renovate$|cash:)/.test(action)){`;
const c = s.split(A1).length - 1;
if (c !== 1) { console.error("ABORT: anchor count " + c + " (expected 1). File untouched."); process.exit(1); }

s = s.replace(A1, `if(/^(p2pbuy$|buy$|renovate$|cash:|pass$)/.test(action)){   // __KV_V225: pass dedups too`);

fs.writeFileSync(DST, s);
console.log("PASS anchor 1/1 — pass moves dedup at the choke point");
console.log("OK " + DST + " (" + (fs.statSync(DST).size/1048576).toFixed(1) + " MB)");
