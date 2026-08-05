// fix_addr_stats.cjs — makes lookupByAddress return the /user-stats data it already fetched
// during prefix resolution, instead of re-fetching via /api/counterparty (which returns
// divergent numbers). Line-level edits: immune to CRLF/LF mixing. Count-guarded, .bak7 backup.
// Run from: C:\Users\wayne\Downloads\kasvillage layer1
//   node fix_addr_stats.cjs

const fs = require("fs");
const f = "counterparty_lookup.ts";
const orig = fs.readFileSync(f, "utf8");

const crlf = (orig.match(/\r\n/g) || []).length;
const lfOnly = (orig.match(/(?<!\r)\n/g) || []).length;
const nl = crlf >= lfOnly ? "\r\n" : "\n";
const lines = orig.split(/\r?\n/);

// --- locate the address function via its unique comment ---
const ci = lines.findIndex(l => l.includes("LOCAL-DECODE: the address encodes the x-only pubkey"));
if (ci === -1) { console.error("comment not found -- ABORT"); process.exit(1); }
if (!/let pubkey: string \| null = null;/.test(lines[ci + 1])) { console.error("pubkey decl not at ci+1 -- ABORT"); process.exit(1); }
if (orig.includes("let _winStats: any = null;")) { console.error("already patched -- ABORT"); process.exit(1); }

// 1) declare _winStats at function scope (after pubkey decl)
lines.splice(ci + 2, 0, "  let _winStats: any = null;");

// 2) capture winning stats inside the prefix loop
const li = lines.findIndex(l => l.includes("pubkey = _cand;") && l.includes("_st.total_samples"));
if (li === -1) { console.error("loop line not found -- ABORT"); process.exit(1); }
lines[li] = lines[li].replace("pubkey = _cand;", "pubkey = _cand; _winStats = _st;");

// 3) short-circuit the return: use direct stats when the probe found them
let ri = -1;
for (let j = ci; j < lines.length; j++) {
  if (lines[j].includes("const result = await lookupCounterparty(pubkey, options);")) { ri = j; break; }
}
if (ri === -1) { console.error("lookupCounterparty call not found after comment -- ABORT"); process.exit(1); }
if (!lines[ri + 1].includes("return { pubkey, stats: result.stats };")) { console.error("return line not at ri+1 -- ABORT"); process.exit(1); }
lines.splice(ri, 0,
  "  if (_winStats) {",
  "    const _mapped = computeStats(pubkey, _winStats.xp || 0, _winStats.successes || 0, _winStats.deadlocks || 0);",
  "    return { pubkey, stats: _mapped };",
  "  }"
);

fs.writeFileSync(f + ".bak7", orig);
fs.writeFileSync(f, lines.join(nl));

// post-check
const check = fs.readFileSync(f, "utf8");
const ok = check.includes("let _winStats: any = null;")
  && check.includes("_winStats = _st;")
  && check.includes("const _mapped = computeStats(pubkey");
if (!ok) { console.error("POST-CHECK FAILED — restore from " + f + ".bak7"); process.exit(1); }
console.log("patched OK. decl@" + (ci + 3) + " capture@" + (li + 1) + " return-guard@" + (ri + 1));
console.log("next: npx tsc --noEmit  (expect baseline 126)");
