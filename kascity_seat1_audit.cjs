// kascity_seat1_audit.cjs — list every tree rule guarded by `seat() <= humans` whose actions
// touch something seat-1-specific (p1, token_p1, cash1, own_*_1, tok_spr_1, nw1, mrt1 ...).
// Those are the "any human on turn" guards that should be `seat() == 1`.
const fs = require("fs");
const file = process.argv[2] || "showcase_kascity195.html";
const raw = fs.readFileSync(file, "utf8");
const m = raw.match(/loadScene\("((?:[^"\\]|\\.)*)"\)/);
const scene = JSON.parse(JSON.parse('"' + m[1] + '"'));
const seat1 = /(\bp1\b|token_p1|tok_spr_1|cash1\b|\bnw1\b|\bmrt1\b|own_\d+_1\b|_p1\b|"p1"|\bd1\b.*p1)/;
const generic = [];
const suspects = {};
(function w(node){
  if (node == null || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach(w); return; }
  if (Array.isArray(node.sequence)) {
    const conds = node.sequence.filter(x => x && typeof x.cond === "string").map(x => x.cond);
    const acts  = node.sequence.filter(x => x && x.do);
    const g = conds.find(c => /seat\(\) <= world\.flags\.humans/.test(c));
    if (g) {
      const body = JSON.stringify(acts);
      if (seat1.test(body)) {
        const key = g.replace(/\d+/g, "N");
        suspects[key] = (suspects[key] || 0) + 1;
      } else generic.push(g.replace(/\d+/g, "N"));
    }
  }
  for (const k of Object.keys(node)) w(node[k]);
})(scene);
console.log("=== `seat() <= humans` rules whose actions target seat-1 things (guard pattern -> count) ===");
Object.keys(suspects).forEach(k => console.log("  " + suspects[k] + "x  " + k));
if (!Object.keys(suspects).length) console.log("  (none — all seat-1-specific rules are already gated on seat()==1)");
const gc = {}; generic.forEach(g => gc[g] = (gc[g] || 0) + 1);
console.log("\n=== `seat() <= humans` rules with generic actions (likely correct) ===");
Object.keys(gc).forEach(k => console.log("  " + gc[k] + "x  " + k));
