const fs = require("fs");
const f = "counterparty_lookup.ts";
const orig = fs.readFileSync(f, "utf8");
let s = orig;
const lines = s.split(/\r?\n/);
const nl = s.includes("\r\n") ? "\r\n" : "\n";

// Find the address-fn comment line (unique) by substring, use the real line text as anchor.
const ci = lines.findIndex(l => l.includes("LOCAL-DECODE: the address encodes the x-only pubkey"));
if (ci === -1) { console.error("comment line not found -- ABORT"); process.exit(1); }
// The pubkey decl is the next non-empty line.
const declLine = lines[ci + 1];
if (!/let pubkey: string \| null = null;/.test(declLine)) { console.error("decl not where expected:", JSON.stringify(declLine), "-- ABORT"); process.exit(1); }
// Build exact anchor from real file bytes: comment + newline + declLine
const anchor = lines[ci] + nl + declLine;
if (s.split(anchor).length - 1 !== 1) { console.error("anchor count", s.split(anchor).length-1, "-- ABORT"); process.exit(1); }
s = s.replace(anchor, anchor + nl + "  let _winStats: any = null;");

// Capture winning stats inside the loop.
const cap = "if ((_st.total_samples || 0) > 0 || (_st.successes || 0) > 0) { pubkey = _cand;";
if (s.split(cap).length - 1 !== 1) { console.error("cap count", s.split(cap).length-1, "-- ABORT"); process.exit(1); }
s = s.replace(cap, "if ((_st.total_samples || 0) > 0 || (_st.successes || 0) > 0) { pubkey = _cand; _winStats = _st;");

// Return direct stats when available.
const ret = "  const result = await lookupCounterparty(pubkey, options);" + nl + "  return { pubkey, stats: result.stats };";
if (s.split(ret).length - 1 !== 1) { console.error("ret count", s.split(ret).length-1, "-- ABORT"); process.exit(1); }
s = s.replace(ret,
"  if (_winStats) {" + nl +
"    const _mapped = computeStats(pubkey, _winStats.xp || 0, _winStats.successes || 0, _winStats.deadlocks || 0);" + nl +
"    return { pubkey, stats: _mapped };" + nl +
"  }" + nl +
"  const result = await lookupCounterparty(pubkey, options);" + nl +
"  return { pubkey, stats: result.stats };");

fs.writeFileSync(f + ".bak7", orig);
fs.writeFileSync(f, s);
console.log("patched (decl at function scope, via file-read anchor)");
