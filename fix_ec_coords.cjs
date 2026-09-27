// fix_ec_coords.cjs - installed games boot offline; coords reach the fetcher.
//
// TWO BUGS, both visible in the error text "manifest: no config chunks found"
// with NO "; walk: ..." suffix - meaning the coordinate walk was never even
// attempted:
//
//   1. OnChainPageView called fetchGamePuzzle WITHOUT the coords argument.
//      Only the Mailbox install path passed them, so booting from the
//      Entertainment Center skipped the walk entirely.
//   2. EntertainmentCenter built its game prop from only
//      {manifestAddress, manifestHash, head} - dropping anchor_hash/daa_from/
//      daa_to, which kv_installed_games already stores via the ...q spread.
//
// Net effect: once the relay recycled, an installed game had no route to its
// own chunks even though the coordinates were sitting on the device.
//
// Also adds boot diagnostics: the error now says whether coords were present,
// and the full context goes to console.
// Run from layer1 root:  node src\\fix_ec_coords.cjs
const fs = require("fs");
function patch(P, edits, guard) {
  let s = fs.readFileSync(P, "utf8");
  const CRLF = s.includes("\r\n");
  if (CRLF) s = s.replace(/\r\n/g, "\n");
  if (s.includes(guard)) { console.log("already patched  [" + P + "]"); return; }
  for (const [name, a, b] of edits) {
    const f = s.split(a).length - 1;
    if (f !== 1) { console.error("ABORT [" + name + "]: found " + f + ", expected 1"); process.exit(1); }
    s = s.split(a).join(b); console.log("ok  [" + name + "]");
  }
  fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
}
patch("EntertainmentCenter.tsx", [["ec-pass-coords", "        game={{ manifestAddress: playingChain.manifestAddress, manifestHash: playingChain.manifestHash, head: playingChain.head }}", "        game={{ manifestAddress: playingChain.manifestAddress, manifestHash: playingChain.manifestHash, head: playingChain.head,\n          anchor_hash: (playingChain as any).anchor_hash, daa_from: (playingChain as any).daa_from, daa_to: (playingChain as any).daa_to }}"]], "anchor_hash: (playingChain");
patch("OnChainPageView.tsx", [
  ["view-forward-coords", "        ? await fetchGamePuzzle(props.game.manifestAddress, props.game.manifestHash, props.game.head, network,\n            (have, total) => { if (alive) setProgress('solving puzzle ' + have + '/' + total); })", "        ? await fetchGamePuzzle(props.game.manifestAddress, props.game.manifestHash, props.game.head, network,\n            (have, total) => { if (alive) setProgress('solving puzzle ' + have + '/' + total); },\n            // Coordinates must reach the fetcher here too, not only on Mailbox\n            // install. Without them the coordinate walk is skipped entirely and\n            // a recycled relay leaves an installed game unbootable.\n            ((props.game as any).anchor_hash || (props.game as any).daa_to) ? {\n              anchor_hash: (props.game as any).anchor_hash,\n              daa_from: (props.game as any).daa_from,\n              daa_to: (props.game as any).daa_to,\n            } : undefined)"],
  ["boot-diagnostics", "      else setError(res.error || 'page unavailable');", "      else {\n        const g: any = props.game || {};\n        const diag = props.game\n          ? ' [head ' + String(g.head || '').slice(0, 10) + ' \u00b7 coords ' + (g.anchor_hash || g.daa_to ? 'yes' : 'NO') + ']'\n          : '';\n        try { console.log('[KV] game boot failed', { err: res.error, head: g.head, anchor: g.anchor_hash, from: g.daa_from, to: g.daa_to }); } catch {}\n        setError((res.error || 'page unavailable') + diag);\n      }"],
], "game boot failed");
console.log("\ndone. Installed games now walk the chain on boot, and boot errors say why.");
