// fix_quad_pledge.cjs - the quad now carries PLEDGE_KAS.
//
// The KAS parked in the game's chunk UTXOs is the dev's size-proportional,
// trustlessly verifiable stake (sweep the dust = visible delisting). Both
// PUBLISH and ANNOUNCE already walk those UTXOs for the daa span - this sums
// their amounts in the same pass and stamps pledge_kas into the quad, so
// cards can show the stake with zero extra fetches.
// Run from layer1 root:  node src\\fix_quad_pledge.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("pledge_kas")) { console.log("already patched"); process.exit(0); }
function repN(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: found " + f + ", expected " + exp); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "] x" + exp);
}
repN("pl-var", "let lo = Number.MAX_SAFE_INTEGER, hi = 0;", "let lo = Number.MAX_SAFE_INTEGER, hi = 0, pl = 0;", 2);
repN("pl-sum", "            if (d > 0) { if (d < lo) lo = d; if (d > hi) hi = d; }", "            if (d > 0) { if (d < lo) lo = d; if (d > hi) hi = d; }\n            pl += Number(u.utxoEntry?.amount || u.amount || 0);", 2);
repN("quad-announce", "        if (hi > 0) daaSpan = { daa_from: Math.max(0, lo - 600), daa_to: hi + 600, ...(publishAnchor ? { anchor_hash: publishAnchor } : {}) };", "        if (hi > 0) daaSpan = { pledge_kas: Math.round(pl / 1e7) / 10, daa_from: Math.max(0, lo - 600), daa_to: hi + 600, ...(publishAnchor ? { anchor_hash: publishAnchor } : {}) };", 1);
repN("quad-publish", "        if (hi > 0) daaSpan = { daa_from: Math.max(0, lo - 600), daa_to: hi + 600, ...(publishAnchor ? { anchor_hash: publishAnchor } : {}) } as any; // \u00b11 min margin", "        if (hi > 0) daaSpan = { pledge_kas: Math.round(pl / 1e7) / 10, daa_from: Math.max(0, lo - 600), daa_to: hi + 600, ...(publishAnchor ? { anchor_hash: publishAnchor } : {}) } as any; // \u00b11 min margin", 1);
repN("span-log", "        gadd('walk span: daa ' + daaSpan.daa_from + ' .. ' + daaSpan.daa_to);", "        gadd('walk span: daa ' + daaSpan.daa_from + ' .. ' + daaSpan.daa_to + ' | pledge ' + (daaSpan.pledge_kas || 0) + ' KAS');", 2);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + ". Quads now advertise pledge_kas.");
