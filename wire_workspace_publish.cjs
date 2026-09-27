// wire_workspace_publish.cjs — CHAIN GAME PUBLISH section in Workspace's submit tab.
//
// Run from the layer1 root (CRLF-safe, idempotent):
//   node src\wire_workspace_publish.cjs      -> patches Workspace.tsx
//
// Adds:
//   - <KvChainGamePublish/> at the TOP of the submit tab: reads
//     chain414_bundle.json (node src\bundle_chain414.cjs first), keys via
//     _kvResolvePrivHex + kv_kaspa_address (Workspace's own pattern), slot
//     addresses deriveStoreKeys(priv, 9414+slot), manifest at nonce 9500,
//     publishGamePuzzle -> round-trip fetchGamePuzzle -> launch triple to
//     clipboard.
//   - OWNER GATE: renders only when the wallet address matches KV_PUBLISHER_ADDR,
//     so ordinary users never see it.
const fs = require("fs");
const P = "Workspace.tsx";
let s = fs.readFileSync(P, "utf8");
const CRLF = s.includes("\r\n");
if (CRLF) s = s.replace(/\r\n/g, "\n");
if (s.includes("KvChainGamePublish")) { console.log("already wired"); process.exit(0); }
let n = 0;
function rep(name, anchor, to, expected) {
  const found = s.split(anchor).length - 1;
  if (found !== expected) { console.error(`ABORT [${name}]: expected ${expected}, found ${found}`); process.exit(1); }
  s = s.split(anchor).join(to); n++; console.log("ok  [" + name + "]");
}

const COMPONENT = `
// ============================================================================
// [KV-CHAIN-GAME] owner-gated publisher: KasCity puzzle -> Kaspa payload rail
// ============================================================================
const KV_PUBLISHER_ADDR = 'kaspatest:qp7592kfylul443ee5950xe7jgv4rkgrv87ju8s96xz0sy3t79cnxmdmtcusz';
const KvChainGamePublish: React.FC = () => {
  const [myAddr, setMyAddr] = useState('');
  const [glog, setGlog] = useState<string[]>([]);
  const [gbusy, setGbusy] = useState(false);
  const [triple, setTriple] = useState('');
  useEffect(() => { (async () => {
    setMyAddr((await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '');
  })(); }, []);
  const gadd = (l: string) => setGlog((p) => [...p.slice(-150), l]);
  const runPublish = async () => {
    if (gbusy) return;
    setGbusy(true);
    try {
      const BUNDLE = require('./chain414_bundle.json');
      const { publishGamePuzzle, fetchGamePuzzle, TRUSTED_GAMES } = require('./game_chunks');
      const { deriveStoreKeys } = require('./payload_publish');
      const { _kvResolvePrivHex } = require('./proposal_share');
      const priv = await _kvResolvePrivHex();
      if (!priv || !myAddr) { gadd('ERROR: wallet keys unavailable'); setGbusy(false); return; }
      const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
      const owner = { privateKeyHex: priv, pubkeyHex: pub, address: myAddr, network: 'testnet-10' as any };
      const m = BUNDLE.manifest;
      if (m.head !== TRUSTED_GAMES['kascity-414-chain']) { gadd('ERROR: bundle HEAD is not the pinned build'); setGbusy(false); return; }
      const slots = Math.max(...m.frags.map((f: any) => f.slot)) + 1;
      const slotAddresses = Array.from({ length: slots }, (_, i) => deriveStoreKeys(priv, 9414 + i, owner.network).address);
      const manifestAddress = deriveStoreKeys(priv, 9500, owner.network).address;
      slotAddresses.forEach((a: string, i: number) => gadd('slot ' + i + ' ' + a));
      gadd('manifest ' + manifestAddress);
      gadd(BUNDLE.frags.length + ' fragments -> publishing (keep this screen open)…');
      const t0 = Date.now();
      const res = await publishGamePuzzle(owner, m, BUNDLE.frags, slotAddresses, manifestAddress,
        (done: number, total: number) => gadd('fragment ' + done + '/' + total + ' (' + Math.round((Date.now() - t0) / 1000) + 's)'));
      if (!res.success) { gadd('PUBLISH FAILED: ' + res.error); setGbusy(false); return; }
      gadd('manifest published, hash ' + res.manifestHash);
      gadd('verifying: solving the puzzle back from chain…');
      const back = await fetchGamePuzzle(manifestAddress, res.manifestHash, m.head, owner.network);
      gadd(back.html ? 'ROUND-TRIP OK (' + back.html.length + ' bytes)' : 'ROUND-TRIP FAILED: ' + back.error);
      const t = JSON.stringify({ game: 'kascity-414-chain', manifestAddress, manifestHash: res.manifestHash, head: m.head });
      setTriple(t);
      await Clipboard.setStringAsync(t);
      gadd('LAUNCH TRIPLE copied to clipboard.');
    } catch (e: any) {
      gadd('ERROR: ' + String(e?.message || e));
    } finally { setGbusy(false); }
  };
  if (myAddr !== KV_PUBLISHER_ADDR) return null;   // owner gate
  return (
    <View style={{ backgroundColor: '#141210', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#6a5a34' }}>
      <Text style={{ color: '#f0c860', fontWeight: '900', fontFamily: 'monospace', fontSize: 14 }}>?? PUBLISH KASCITY ON CHAIN</Text>
      <Text style={{ color: '#9a8f78', fontFamily: 'monospace', fontSize: 10, marginVertical: 6 }}>66 fragments · ~390 txs · sequential · owner-only section</Text>
      <TouchableOpacity disabled={gbusy} onPress={runPublish} style={{ backgroundColor: '#2a2118', borderWidth: 1, borderColor: '#6a5a34', borderRadius: 8, padding: 12, alignItems: 'center', opacity: gbusy ? 0.5 : 1 }}>
        <Text style={{ color: '#f0c860', fontFamily: 'monospace', fontWeight: '700' }}>{gbusy ? 'PUBLISHING…' : 'PUBLISH TO TESTNET-10'}</Text>
      </TouchableOpacity>
      <View style={{ maxHeight: 220, marginTop: 8 }}>
        <ScrollView nestedScrollEnabled>
          {glog.map((l, i) => <Text key={i} style={{ color: '#e8ddc8', fontSize: 10, fontFamily: 'monospace' }}>{l}</Text>)}
        </ScrollView>
      </View>
      {triple ? <Text selectable style={{ color: '#3fc1b0', fontSize: 10, fontFamily: 'monospace', marginTop: 6 }}>{triple}</Text> : null}
    </View>
  );
};
`;

rep("component", "// DAPP QUALITY GATE MODAL", COMPONENT + "\n// DAPP QUALITY GATE MODAL", 1);
rep("mount",
  "            {activeTab === 'submit' && (\n              <View style={acStyles.tabContent}>",
  "            {activeTab === 'submit' && (\n              <View style={acStyles.tabContent}>\n                <KvChainGamePublish />", 1);

fs.writeFileSync(P, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("\npatched " + P + " (" + n + " patches).");
console.log("prereq: node src\\bundle_chain414.cjs  (writes chain414_bundle.json)");
console.log("then: npx expo start --dev-client -> Workspace -> Submit tab -> PUBLISH");
