// wire_install_coords.cjs - mailbox DOWNLOAD passes the quad's coordinates
// so fetchGamePuzzle can fall back to the on-phone chain walk.
// Requires wire_walk_install.cjs applied to game_chunks first.
// Run from layer1 root:  node src\\wire_install_coords.cjs
const fs = require("fs");
const P = "VillageMailbox.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("anchor_hash: q.anchor_hash")) { console.log("already patched"); process.exit(0); }
const a = "      const r = await gc.fetchGamePuzzle(q.manifestAddress, q.manifestHash, q.head, 'testnet-10');";
const b = "      const r = await gc.fetchGamePuzzle(q.manifestAddress, q.manifestHash, q.head, 'testnet-10', undefined,\n        { anchor_hash: q.anchor_hash, daa_from: q.daa_from, daa_to: q.daa_to });";
const f = s.split(a).length - 1;
if (f !== 1) { console.error("ABORT [coords-thread]: found " + f + ", expected 1"); process.exit(1); }
s = s.split(a).join(b);
console.log("ok  [coords-thread]");
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (1 edit). DOWNLOAD threads coordinates to the walk fallback.");
