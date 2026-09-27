// wire_card_bayes.cjs - Bayesian trust score on the Games card.
//
// Same formula TownHall uses server-side (main.rs USER COMPLETION STATS):
//   p_complete = (1 + successes) / (2 + successes + deadlocks)   [Beta(1,1)]
//   confidence = min(total_samples / 10, 1)
// Evidence = FROST agreement outcomes. Computed client-side from the
// getUserStats call the trust card already makes - zero extra fetches.
// Requires wire_card_trust.cjs applied first.
// Run from layer1 root:  node src\\wire_card_bayes.cjs
const fs = require("fs");
const P = "VillageMailbox.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("setTr")) { console.log("already patched"); process.exit(0); }
if (!s.includes("setXp")) { console.error("ABORT: wire_card_trust.cjs must be applied first"); process.exit(1); }
function rep(name, a, b) {
  const f = s.split(a).length - 1;
  if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "]");
}
rep("tr-state", "  const [xp, setXp] = R.useState(null as number | null);", "  const [xp, setXp] = R.useState(null as number | null);\n  const [tr, setTr] = R.useState(null as any);");
rep("tr-compute", "        if (alive && st && typeof st.xp === 'number') setXp(st.xp);", "        if (alive && st) {\n          if (typeof st.xp === 'number') setXp(st.xp);\n          // Bayesian trust, same formula as TownHall (main.rs):\n          // p_complete = (1+S)/(2+S+D), confidence = min(samples/10, 1)\n          const S = Number(st.successes || 0), D = Number(st.deadlocks || 0);\n          const N = Number(st.total_samples || (S + D));\n          setTr({ p: (1 + S) / (2 + S + D), c: Math.min(N / 10, 1) });\n        }");
rep("tr-render", "      {item.warn ? (", "      {tr ? (\n        <Text style={{ color: tr.p >= 0.5 ? '#059669' : '#dc2626', fontSize: 11, marginTop: 2 }} numberOfLines={1}>\n          {'\u2714 trust ' + Math.round(tr.p * 100) + '% \u00b7 conf ' + Math.round(tr.c * 100) + '%' + (tr.p < 0.5 ? ' \u00b7 \u26a0 low' : '')}\n        </Text>\n      ) : null}\n      {item.warn ? (");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (3 edits). Card shows Bayesian trust % + confidence.");
