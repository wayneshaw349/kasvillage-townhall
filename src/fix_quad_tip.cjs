// fix_quad_tip.cjs - the quad carries the dev's TIP ADDRESS (opt-in).
//
// tip_addr = the publishing wallet's own address, stamped into the announced
// quad by PUBLISH and ANNOUNCE. Cards render a TIP button ONLY when a quad
// declares it - the dev opts in by publishing with it; no ambient payment UI
// is ever rendered for a dev who did not ask. KasVillage never holds, routes
// through, or fees these funds: tips are user-signed sends, peer to peer.
// Run from layer1 root:  node src\\fix_quad_tip.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("tip_addr: myAddr")) { console.log("already patched"); process.exit(0); }
function rep(name, a, b) {
  const f = s.split(a).length - 1;
  if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
  s = s.split(a).join(b); console.log("ok  [" + name + "]");
}
rep("tip-announce-quad", "      const quad = { game: gameId, manifestAddress, manifestHash, head: m.head, ...daaSpan };", "      const quad = { game: gameId, manifestAddress, manifestHash, head: m.head, tip_addr: myAddr, ...daaSpan };");
rep("tip-publish-triple", "      const t = JSON.stringify({ game: gameId, manifestAddress, manifestHash: res.manifestHash, head: m.head, ...daaSpan });", "      const t = JSON.stringify({ game: gameId, manifestAddress, manifestHash: res.manifestHash, head: m.head, tip_addr: myAddr, ...daaSpan });");
rep("tip-publish-quad", "        const quad = { game: gameId, manifestAddress, manifestHash: res.manifestHash, head: m.head, ...daaSpan };", "        const quad = { game: gameId, manifestAddress, manifestHash: res.manifestHash, head: m.head, tip_addr: myAddr, ...daaSpan };");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (3 edits). Quads now declare tip_addr (dev opt-in).");
