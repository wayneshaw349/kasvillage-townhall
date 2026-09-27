// wire_game_announce.cjs — after ROUND-TRIP OK the panel announces the game to
// the GAME REGISTRY (registryAddress('game') — deterministic, nobody hosts it).
// The full quad {game, manifestAddress, manifestHash, head, daa_from, daa_to,
// anchor_hash} rides as JSON in d.primaryLink (announce schema keeps only
// known keys). ~1 KAS. The mailbox Games lane reads exactly this.
// Run from layer1 root:  node src\wire_game_announce.cjs
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("announcing to game registry")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("game-announce",
`      gadd('LAUNCH TRIPLE copied to clipboard.');`,
`      try {
        gadd('announcing to game registry…');
        const { announceToRegistry } = require('./payload_publish');
        const quad = { game: gameId, manifestAddress, manifestHash: res.manifestHash, head: m.head, ...daaSpan };
        const _ann: any = await announceToRegistry(owner, manifestAddress, gameId, 'Game', 'game', { primaryLink: JSON.stringify(quad), configHash: res.manifestHash } as any);
        if (_ann && _ann.success !== false) gadd('registry announce OK -> ' + String(_ann.registryAddr || '').slice(0, 24) + '…');
        else gadd('announce failed (game still live): ' + String((_ann && _ann.error) || 'unknown'));
      } catch (e: any) { gadd('announce error (game still live): ' + String(e?.message || e)); }
      gadd('LAUNCH TRIPLE copied to clipboard.');`, 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). Next publish auto-announces to the game registry.");
