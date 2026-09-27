// wire_ec_installed.cjs — Entertainment Center plays INSTALLED CHAIN GAMES.
//
// Reads kv_installed_games (written by the Mailbox Games DOWNLOAD), lists each
// as a dapp card (category "On-Chain", board "Main"), and launching one opens
// OnChainPageView in game mode full-screen: cache-first, hash chain to HEAD,
// full-page sha — the same verified path the wallet uses.
// Run from layer1 root:  node src\wire_ec_installed.cjs
const fs = require("fs");
const P = "EntertainmentCenter.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("kv_installed_games")) { console.log("already patched"); process.exit(0); }
let n = 0;
function rep(name, a, b, exp) {
  const f = s.split(a).length - 1;
  if (f !== exp) { console.error("ABORT [" + name + "]: expected " + exp + ", found " + f); process.exit(1); }
  s = s.split(a).join(b); n++; console.log("ok  [" + name + "]");
}
rep("import-ocpv",
`import EngineHost from './EngineHost';`,
`import EngineHost from './EngineHost';
import OnChainPageView from './OnChainPageView';`, 1);
rep("chain-state",
`  const [dapps, setDapps] = useState<DApp[]>(mockDApps);`,
`  const [dapps, setDapps] = useState<DApp[]>(mockDApps);
  const [playingChain, setPlayingChain] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const AS = require('@react-native-async-storage/async-storage').default;
        const raw = await AS.getItem('kv_installed_games');
        const inst = raw ? JSON.parse(raw) : [];
        if (!inst.length) return;
        const cards: DApp[] = inst.map((g: any) => ({
          id: 'chain-' + (g.head || g.id),
          name: g.name || g.id,
          category: 'On-Chain',
          board: 'Main',
          description: 'Downloaded from Kaspa — hash-verified',
          url: '',
          ...( { chainGame: g } as any ),
        } as any));
        setDapps((prev) => [...cards, ...prev.filter((d) => !String(d.id).startsWith('chain-'))]);
      } catch (e) { console.warn('[EC] installed games load failed:', e); }
    })();
  }, []);`, 1);
rep("chain-launch",
`    setLaunching(true);
    try {
      const _gh = (dapp as any).gameHash || '';`,
`    setLaunching(true);
    const _cg = (dapp as any).chainGame;
    if (_cg && _cg.manifestAddress && _cg.head) {
      // Installed chain game: OnChainPageView solves cache-first + verifies.
      setPlayingChain(_cg);
      setLaunching(false);
      return;
    }
    try {
      const _gh = (dapp as any).gameHash || '';`, 1);
rep("chain-player",
`  if (playingGame) {`,
`  if (playingChain) {
    return (
      <OnChainPageView
        storeAddress={playingChain.manifestAddress}
        pageHash={playingChain.manifestHash}
        network={'testnet-10'}
        game={{ manifestAddress: playingChain.manifestAddress, manifestHash: playingChain.manifestHash, head: playingChain.head }}
        onClose={() => setPlayingChain(null)}
      />
    );
  }
  if (playingGame) {`, 1);
fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + "). Installed chain games appear in EC and play full-screen.");
