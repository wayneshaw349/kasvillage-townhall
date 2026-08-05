const fs = require("fs");
const f = "counterparty_lookup.ts";
const orig = fs.readFileSync(f, "utf8");
const crlf = (orig.match(/\r\n/g) || []).length;
const lfOnly = (orig.match(/(?<!\r)\n/g) || []).length;
const nl = crlf >= lfOnly ? "\r\n" : "\n";
const lines = orig.split(/\r?\n/);

const fi = lines.findIndex(l => l.includes("export async function lookupByApt("));
if (fi === -1) { console.error("lookupByApt not found -- ABORT"); process.exit(1); }
let ri = -1;
for (let j = fi; j < Math.min(fi + 40, lines.length); j++) {
  if (lines[j].includes("const result = await lookupCounterparty(pubkey, options);")) { ri = j; break; }
}
if (ri === -1) { console.error("call not found -- ABORT"); process.exit(1); }
if (!lines[ri + 1].includes("return { pubkey, stats: result.stats };")) { console.error("return not at ri+1 -- ABORT"); process.exit(1); }
if (orig.includes("// APT: direct /user-stats")) { console.error("already patched -- ABORT"); process.exit(1); }

lines.splice(ri, 0,
  "  // APT: direct /user-stats (same source as pubkey & address paths)",
  "  try {",
  "    const _r = await fetch('https://kasvillage.app.runonflux.io/user-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pubkey }) });",
  "    if (_r.ok) {",
  "      const _st = await _r.json();",
  "      if ((_st.total_samples || 0) > 0 || (_st.successes || 0) > 0 || (_st.xp || 0) > 0) {",
  "        return { pubkey, stats: computeStats(pubkey, _st.xp || 0, _st.successes || 0, _st.deadlocks || 0) };",
  "      }",
  "    }",
  "  } catch (e) { console.warn('[Resolve] APT direct stats failed, falling back:', e); }"
);

fs.writeFileSync(f + ".bak8", orig);
fs.writeFileSync(f, lines.join(nl));
if (!fs.readFileSync(f,"utf8").includes("// APT: direct /user-stats")) { console.error("POST-CHECK FAILED"); process.exit(1); }
console.log("lookupByApt now uses /user-stats directly. inserted@" + (ri + 1));
