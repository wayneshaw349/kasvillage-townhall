// wire_delist_button.cjs — DELIST button per game in Workspace.
// Confirm alert -> delistFromRegistry(owner, head, 'game') (~1 KAS signed record).
// Hide-from-store only: installed copies untouched. Targets the currently
// bundled head (entry.bundle.manifest.head), same head ANNOUNCE advertises.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('runDelist')) { console.log('already patched'); process.exit(0); }

// --- 1. runDelist, inserted above runAnnounceOnly ---
const A1 = "  const runAnnounceOnly = async (gameId: string) => {";
const c1 = s.split(A1).length - 1;
if (c1 !== 1) { console.error('ANCHOR 1 count =', c1, '- expected 1. Aborting.'); process.exit(1); }

const FN = `  const runDelist = async (gameId: string) => {
    if (gbusy) return;
    const entry = GAMES[gameId];
    if (!entry) return;
    const head = entry.bundle.manifest.head;
    Alert.alert('Delist ' + gameId + '?', 'Posts a signed delist record (~1 KAS). New users stop seeing it in the store; installed copies keep playing.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delist', style: 'destructive', onPress: async () => {
        setGbusy(gameId); setGlog([]);
        try {
          const { delistFromRegistry } = require('./payload_publish');
          const { _kvResolvePrivHex } = require('./proposal_share');
          const priv = await _kvResolvePrivHex();
          if (!priv || !myAddr) { gadd('ERROR: wallet keys unavailable'); setGbusy(''); return; }
          const pub = bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true));
          const owner = { privateKeyHex: priv, pubkeyHex: pub, address: myAddr, network: 'testnet-10' as any };
          const res: any = await delistFromRegistry(owner, head, 'game');
          if (res && res.success !== false) gadd('DELISTED ' + gameId + ' (head ' + String(head).slice(0, 10) + '\\u2026) -> ' + String(res.registryAddr || '').slice(0, 24) + '\\u2026');
          else gadd('delist failed: ' + String((res && res.error) || 'unknown'));
        } catch (e: any) { gadd('delist error: ' + String(e?.message || e)); }
        setGbusy('');
      } },
    ]);
  };
`;
s = s.replace(A1, FN + A1);

// --- 2. DELIST button after the ANNOUNCE button ---
const A2 = "        <TouchableOpacity key={id + '-ann'} disabled={!!gbusy} onPress={() => runAnnounceOnly(id)}\n          style={{ backgroundColor: '#241f36', borderWidth: 1, borderColor: '#7c5cff', borderRadius: 8, padding: 10, marginBottom: 6 }}>\n          <Text style={{ color: '#b9a6ff', fontWeight: '800', fontFamily: 'monospace', fontSize: 12 }}>\n            {gbusy === id ? 'WORKING…' : 'ANNOUNCE ' + id + ' (registry only, ~1 KAS)'}\n          </Text>\n        </TouchableOpacity>";
const c2 = s.split(A2).length - 1;
if (c2 !== 1) { console.error('ANCHOR 2 count =', c2, '- expected 1. Aborting.'); process.exit(1); }

const BTN = A2 + "\n        <TouchableOpacity key={id + '-del'} disabled={!!gbusy} onPress={() => runDelist(id)}\n          style={{ backgroundColor: '#2d1a1a', borderWidth: 1, borderColor: '#b14b4b', borderRadius: 8, padding: 10, marginBottom: 6 }}>\n          <Text style={{ color: '#e08b8b', fontWeight: '800', fontFamily: 'monospace', fontSize: 12 }}>\n            {'DELIST ' + id + ' (hide from store, ~1 KAS)'}\n          </Text>\n        </TouchableOpacity>";
s = s.replace(A2, BTN);

if (CRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(F, s);
console.log('patched: runDelist + DELIST button per game');
