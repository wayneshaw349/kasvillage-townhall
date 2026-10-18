// wire_cold_scan.cjs — "Scan cold key (QR)" for moderation. Run AFTER wire_cold_mod.cjs.
// Delist on someone else's listing -> Scan cold key (QR) -> camera reads the printed QR
// straight into memory -> verified against the mod pubkey -> sign once -> forgotten.
// Typing stays available as a fallback. Uses expo-camera (already installed).
const fs = require('fs');
const F = 'VillageMailbox.tsx';
let s = fs.readFileSync(F, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_COLD_SCAN')) { console.log('already patched'); process.exit(0); }
if (!s.includes('KV_COLD_MOD')) { console.error('Run wire_cold_mod.cjs first.'); process.exit(1); }
const edits = [
  // state
  ["  const [gameView, setGameView] = useState<{",
   "  const [coldScan, setColdScan] = useState<{ onKey: (t: string) => void } | null>(null); // KV_COLD_SCAN\n  const [gameView, setGameView] = useState<{"],
  // shared key check + scanner launcher, before the typed prompt
  ["        const _askCold = () => {\n",
   `        const _useKey = (t: string) => {
          try {
            const k = String(t || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
            const mp = bytesToHex(secp256k1.getPublicKey(hexToBytes(k), true));
            if (mp !== _KV_MOD) { Alert.alert('Wrong key', 'That key does not match the moderation public key.'); return; }
            _modFlow(k, mp);
          } catch (e: any) { Alert.alert('Bad key', String((e && e.message) || e)); }
        };
        const _scanCold = async () => {
          try {
            const ec = require('expo-camera');
            const reqP = (ec.Camera && ec.Camera.requestCameraPermissionsAsync) || ec.requestCameraPermissionsAsync;
            const p: any = reqP ? await reqP() : { granted: true };
            if (!p || !p.granted) { Alert.alert('Camera needed', 'Allow camera access to scan the cold key QR.'); return; }
            setStoreView(null); // iOS can't stack a Modal on an open Modal
            (globalThis as any).__kvScanLock = false;
            setTimeout(() => setColdScan({ onKey: _useKey }), 600);
          } catch (e: any) { Alert.alert('Scanner error', String((e && e.message) || e)); }
        };
        const _askCold = () => {
`],
  // menu: scan first, type as fallback
  ["          { text: 'Moderator (cold key)\\u2026', onPress: _askCold },\n",
   "          { text: 'Scan cold key (QR)', onPress: _scanCold },\n          { text: 'Type cold key\\u2026', onPress: _askCold },\n"],
  // scanner modal
  ["      <Modal visible={!!gameView} animationType=\"slide\" transparent onRequestClose={() => setGameView(null)}>",
   `      {/* KV_COLD_SCAN scanner */}
      <Modal visible={!!coldScan} animationType="slide" onRequestClose={() => setColdScan(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {coldScan ? (() => { const { CameraView } = require('expo-camera'); return (
            <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(ev: any) => {
                const g: any = globalThis as any; if (g.__kvScanLock) return; g.__kvScanLock = true;
                const cs = coldScan; setColdScan(null);
                const d = String((ev && ev.data) || '');
                setTimeout(() => { if (cs) cs.onKey(d); }, 500);
              }} />
          ); })() : null}
          <Text style={{ position: 'absolute', top: 70, alignSelf: 'center', color: '#fff', fontWeight: '700', fontSize: 16 }}>Point at the cold-key QR</Text>
          <TouchableOpacity onPress={() => setColdScan(null)} style={{ position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 }}>
            <Text style={{ fontWeight: '700', fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={!!gameView} animationType="slide" transparent onRequestClose={() => setGameView(null)}>`],
  // typed prompt reuses the shared check
  ["              { text: 'Unlock', onPress: (t: string) => {\n                try {\n                  const k = String(t || '').trim().toLowerCase();\n                  const mp = bytesToHex(secp256k1.getPublicKey(hexToBytes(k), true));\n                  if (mp !== _KV_MOD) { Alert.alert('Wrong key', 'That key does not match the moderation public key.'); return; }\n                  _modFlow(k, mp);\n                } catch (e: any) { Alert.alert('Bad key', String((e && e.message) || e)); }\n              } },",
   "              { text: 'Unlock', onPress: (t: string) => _useKey(t) },"],
];
let ok = true;
for (const [a] of edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error('ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 60).replace(/\n/g, ' ')); ok = false; } }
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Scan cold key (QR) - camera reads the key into memory, signs once, forgets');
