// fix_autofit_margin.cjs - auto-fit leaves breathing room.
//
// AUTO filled the viewport edge to edge, so the board touched the screen
// borders and everything sat at maximum size. 0.88 leaves a margin, which
// reads as "a little smaller" without another control to learn.
//
// Only the DEFAULT changes. The minus and plus buttons still override it, and
// with fix_view_memory.cjs whatever you choose is remembered per game - so
// this only decides what a first-time player sees.
// Run from layer1 root:  node src\\fix_autofit_margin.cjs
const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("*0.88")) { console.log("already patched"); process.exit(0); }
const n = s.split("ss=Math.min(tw/n.w,th/n.h);if(!isFinite(ss)||ss<=0)ss=1;ss=Math.round(ss*100)/100;").length - 1;
if (n !== 1) { console.error("ABORT: found " + n + ", expected 1 (run fix_game_autofit.cjs first)"); process.exit(1); }
s = s.split("ss=Math.min(tw/n.w,th/n.h);if(!isFinite(ss)||ss<=0)ss=1;ss=Math.round(ss*100)/100;").join("ss=Math.min(tw/n.w,th/n.h)*0.88;if(!isFinite(ss)||ss<=0)ss=1;ss=Math.round(ss*100)/100;");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("ok  [autofit-margin 88%]");
console.log("\npatched " + P + ". Auto-fit now leaves a margin.");
