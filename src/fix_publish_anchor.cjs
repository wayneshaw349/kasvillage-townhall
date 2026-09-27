// fix_publish_anchor.cjs — the panel captures a WALK ANCHOR at press time.
//
// getBlocks can only enter the DAG at a block hash. Without one, a walker must
// unroll from the pruning point (~90 min measured). Capturing the sink hash
// the moment PUBLISH starts gives every future walker a doorstep entry: the
// data lands AFTER this block, so  anchor_hash -> daa_to  is a ~1 minute walk.
// Advertised launch data becomes:
//   { game, manifestAddress, manifestHash, head, daa_from, daa_to, anchor_hash }
// The anchor is a hint, never a trust point: wrong anchor = failed walk, and
// head + hashes still verify all content. Pruning-point entry stays the
// trustless fallback. Run from layer1 root:  node src\fix_publish_anchor.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("anchor_hash")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("anchor-capture",
`      gadd(entry.bundle.frags.length + ' fragments -> publishing (keep this screen open)…');`,
`      let publishAnchor = '';
      try {
        const sr = await fetch('https://kasvillage.app.runonflux.io/api/kaspa/sink');
        publishAnchor = String((await sr.json()).sink || '');
        if (publishAnchor) gadd('walk anchor: ' + publishAnchor.slice(0, 16) + '…');
      } catch {}
      gadd(entry.bundle.frags.length + ' fragments -> publishing (keep this screen open)…');`, 1);
rep("anchor-in-triple",
`        if (hi > 0) daaSpan = { daa_from: Math.max(0, lo - 600), daa_to: hi + 600 }; // ±1 min margin`,
`        if (hi > 0) daaSpan = { daa_from: Math.max(0, lo - 600), daa_to: hi + 600, ...(publishAnchor ? { anchor_hash: publishAnchor } : {}) } as any; // ±1 min margin`, 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). Triple now advertises the walk anchor.");
