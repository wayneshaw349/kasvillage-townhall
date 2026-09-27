const fs = require("fs");
const file = process.argv[2] || "showcase_kascity195.html";
const raw = fs.readFileSync(file, "utf8");
const scene = JSON.parse(JSON.parse('"' + raw.match(/loadScene\("((?:[^"\\]|\\.)*)"\)/)[1] + '"'));
const out = { bare: [], buy1: null, buy2: null };
(function w(node){
  if (node == null || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach(w); return; }
  if (Array.isArray(node.sequence)) {
    const conds = node.sequence.filter(x => x && typeof x.cond === "string").map(x => x.cond);
    const acts = node.sequence.filter(x => x && x.do).map(x => x.do);
    const g = conds.join(" && ");
    if (conds.length === 1 && conds[0] === "seat() <= world.flags.humans") out.bare.push(acts);
    if (!out.buy1 && /world\.flags\.buy_tile == \d+ && world\.flags\.buy == 0 && seat\(\) <= world\.flags\.humans/.test(g)) out.buy1 = { g, acts };
    if (!out.buy2 && /world\.flags\.buy_tile == \d+ && world\.flags\.buy == 0 && seat\(\) == 2/.test(g)) out.buy2 = { g, acts };
  }
  for (const k of Object.keys(node)) w(node[k]);
})(scene);
console.log("=== 7 bare `seat() <= humans` rules — their actions ===");
out.bare.forEach((acts, i) => console.log((i+1) + ". " + JSON.stringify(acts).slice(0, 400)));
console.log("\n=== seat-1 buy rule ===\n" + (out.buy1 ? out.buy1.g + "\n" + JSON.stringify(out.buy1.acts).slice(0, 700) : "not found"));
console.log("\n=== seat-2 buy rule ===\n" + (out.buy2 ? out.buy2.g + "\n" + JSON.stringify(out.buy2.acts).slice(0, 700) : "not found"));
