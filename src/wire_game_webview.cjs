// wire_game_webview.cjs — wires chain GAMES into OnChainPageView.tsx.
//
// Adds, count-guarded in Wayne's patcher style (run from the layer1 root:
//   node src\wire_game_webview.cjs         -> patches OnChainPageView.tsx):
//
//   1. props.game?: { manifestAddress; manifestHash; head }
//      -> the page is fetched with fetchGamePuzzle (manifest -> HEAD-pinned
//         hash chain -> 66 fragments via fetchHtmlPage -> full SHA + scan)
//      -> plain store pages keep the existing fetchHtmlPage path, untouched.
//   2. KV_WNET bridge: injected before page scripts (after the existing link
//      BRIDGE), onMessage routes kvwnet traffic to handleKvNetMessage, replies
//      go back via webRef.injectJavaScript. Non-game pages get the inert deny
//      behavior automatically (the wallet bridge only ALLOWS listed hosts, and
//      a page with no KV_WNET calls never notices it).
//   3. Progress line while fragments stream in ("solving puzzle 12/66").
//
// Idempotent: aborts if already wired.
const fs = require("fs");
const P = "OnChainPageView.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");          // Windows checkouts: normalize, patch, restore
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("KV_WNET_INJECT")) { console.log("already wired"); process.exit(0); }
let n = 0;
function rep(name, anchor, to, expected) {
  const found = s.split(anchor).length - 1;
  if (found !== expected) { console.error(`ABORT [${name}]: expected ${expected}, found ${found}`); process.exit(1); }
  s = s.split(anchor).join(to); n++; console.log("ok  [" + name + "]");
}

rep("imports",
  "import { fetchHtmlPage } from './html_chunks';",
  `import { fetchHtmlPage } from './html_chunks';
import { fetchGamePuzzle, TRUSTED_GAMES, GameManifest } from './game_chunks';
import { KV_WNET_INJECT, handleKvNetMessage } from './kv_net_bridge';
import { useRef } from 'react';`, 1);

rep("props",
  "  onClose?: () => void;\n}",
  `  onClose?: () => void;
  /** Chain GAME mode: solve the hash-chained puzzle instead of a single page. */
  game?: { manifestAddress: string; manifestHash: string; head: string };
}`, 1);

rep("state",
  "  const [notice, setNotice] = useState<string | null>(null);",
  `  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const webRef = useRef<any>(null);`, 1);

rep("fetch-game",
  `    (async () => {
      const res = await fetchHtmlPage(storeAddress, pageHash, network);`,
  `    (async () => {
      const res = props.game
        ? await fetchGamePuzzle(props.game.manifestAddress, props.game.manifestHash, props.game.head, network,
            (have, total) => { if (alive) setProgress('solving puzzle ' + have + '/' + total); })
        : await fetchHtmlPage(storeAddress, pageHash, network);`, 1);

rep("wnet-onmessage",
  `  const onMessage = useCallback((event: any) => {
    try {`,
  `  const onMessage = useCallback((event: any) => {
    if (handleKvNetMessage(event.nativeEvent.data, (js) => webRef.current?.injectJavaScript(js))) return;
    try {`, 1);

rep("wnet-inject",
  "        injectedJavaScriptBeforeContentLoaded={BRIDGE}",
  "        ref={webRef}\n        injectedJavaScriptBeforeContentLoaded={BRIDGE + KV_WNET_INJECT}", 1);

rep("progress-line",
  "        <Text style={styles.loading}>Rebuilding page from chain…</Text>",
  "        <Text style={styles.loading}>{progress || 'Rebuilding page from chain…'}</Text>", 1);

fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + " patches).");
console.log("launch a game with:");
console.log("  <OnChainPageView storeAddress={manifestAddress} pageHash={manifestHash} network=\"testnet-10\"");
console.log("    game={{ manifestAddress, manifestHash, head: TRUSTED_GAMES['kascity-414-chain'] }} />");
console.log("then: npx tsc --noEmit");
