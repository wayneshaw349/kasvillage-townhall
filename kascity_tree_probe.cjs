// kascity_tree_probe.cjs v2 — ancestor conditions via sequence-sibling semantics
const fs = require("fs");
const file = process.argv[2] || "showcase_kascity193.html";
const s = fs.readFileSync(file, "utf8");
const m = s.match(/loadScene\("((?:[^"\\]|\\.)*)"\)/);
if (!m) { console.error("loadScene string not found"); process.exit(1); }
const scene = JSON.parse(JSON.parse('"' + m[1] + '"'));

// A "sequence" is {sequence:[...]}: conds earlier in the array gate later items.
// A "selector" is {selector:[...]}: siblings are alternatives (no gating).
function walk(node, conds, path, visit) {
  if (node == null || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n, i) => walk(n, conds, path.concat(i), visit)); return; }
  if (Array.isArray(node.sequence)) {
    let here = conds.slice();
    node.sequence.forEach((item, i) => {
      if (item && typeof item.cond === "string") { here = here.concat(["[seq] " + item.cond]); }
      else walk(item, here, path.concat("sequence", i), visit);
    });
    return;
  }
  if (Array.isArray(node.selector)) { node.selector.forEach((n, i) => walk(n, conds.concat(["[selector branch]"]), path.concat("selector", i), visit)); return; }
  visit(node, conds, path);
  for (const k of Object.keys(node)) {
    if (k === "sequence" || k === "selector") continue;
    walk(node[k], conds, path.concat(k), visit);
  }
}
function report(title, pred) {
  let n = 0;
  walk(scene, [], [], (node, conds, path) => {
    if (!pred(node)) return;
    n++;
    console.log("\n=== " + title + " @ " + path.join("/"));
    conds.forEach((c, i) => console.log("  " + i + ". " + c));
  });
  if (!n) console.log("\n=== " + title + ": NOT FOUND");
}
report("human roll PROMPT", node => node.do && node.do.action === "prompt" && node.do.args && /Tap to roll/.test(String(node.do.args[1])));
report("BOT auto-roll (asked=1 then go=0)", node => node.do && node.do.action === "setState" && node.do.args && node.do.args[0] === "asked" && node.do.args[1] === 1);
report("p1 dice", node => node.do && node.do.action === "setFlagExpr" && node.do.args && node.do.args[0] === "sum" && /^world\.flags\.p1 \+/.test(String(node.do.args[1])));
report("p2 dice", node => node.do && node.do.action === "setFlagExpr" && node.do.args && node.do.args[0] === "sum" && /^world\.flags\.p2 \+/.test(String(node.do.args[1])));
