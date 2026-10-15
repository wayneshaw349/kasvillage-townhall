// wire_phone_proof_local.cjs — "My Evidence Chain" section on PhoneProofScreen.
// ADD-ONLY: the Arweave prover UI below it is untouched. Surfaces what the
// phone already records on every completed agreement (StatChain):
//   - dual-signed completion records (buyer + seller sigs, hash-chained)
//   - SPV anchor per record: release txid, DAA score, block header
//     (the header carries utxoCommitment = MuHash snapshot of ALL of Kaspa
//     at that moment) - survives pruning, verifies with plain SHA256.
// Buttons: Verify Chain (verifyBundle), Copy Bundle (share on request),
// Fetch Anchors (backfillAnchors for records still missing headers).
const fs = require('fs');
const F = 'PhoneProofScreen.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_PHONE_LOCAL')) { console.log('already patched'); process.exit(0); }

const edits = [
  // 1. state + handlers after the error state hook
  [
`  const [error, setError] = useState('');
`,
`  const [error, setError] = useState('');
  // KV_PHONE_LOCAL: on-phone dual-signed evidence chain (Arweave-independent)
  const [myChain, setMyChain] = useState<any[]>([]);
  const [chainVerdict, setChainVerdict] = useState('');
  const [chainCopied, setChainCopied] = useState(false);
  React.useEffect(() => {
    if (!visible) return;
    (async () => { try { const { loadChain } = require('./stat_records'); setMyChain(await loadChain()); } catch (e) { console.log('[PhoneProof] chain load failed:', e); } })();
  }, [visible]);
  const handleChainVerify = async () => {
    try {
      const { exportBundle, verifyBundle } = require('./stat_records');
      const _b = await exportBundle();
      const _pk = (await SecureStore.getItemAsync('kaspa_pubkey')) || (await SecureStore.getItemAsync('kv_public_key')) || '';
      const _v: any = verifyBundle(_b, _pk);
      setChainVerdict(_v && _v.valid !== false && _v.ok !== false ? 'VALID \\u2713' : 'INVALID: ' + String((_v && (_v.reason || _v.error)) || 'see log'));
    } catch (e: any) { setChainVerdict('error: ' + String(e && e.message).slice(0, 40)); }
    setTimeout(() => setChainVerdict(''), 6000);
  };
  const handleChainCopy = async () => {
    try { const { exportBundle } = require('./stat_records'); await Clipboard.setStringAsync(await exportBundle()); setChainCopied(true); setTimeout(() => setChainCopied(false), 2000); } catch (e) { console.log('[PhoneProof] bundle copy failed:', e); }
  };
  const handleAnchorFetch = async () => {
    try { const { backfillAnchors, loadChain } = require('./stat_records'); const _n = await backfillAnchors(20); console.log('[PhoneProof] anchors backfilled:', _n); setMyChain(await loadChain()); } catch (e) { console.log('[PhoneProof] anchor fetch failed:', e); }
  };
`,
  ],
  // 2. section UI right after the Arweave description paragraph
  [
`          <Text style={s.desc}>
            Tally any user's completed trades, deadlocks, and P(complete) directly from Arweave.
            No TownHall needed. Every number is backed by a re-fetchable transaction.
          </Text>
`,
`          <Text style={s.desc}>
            Tally any user's completed trades, deadlocks, and P(complete) directly from Arweave.
            No TownHall needed. Every number is backed by a re-fetchable transaction.
          </Text>

          {/* KV_PHONE_LOCAL: on-phone dual-signed evidence chain */}
          <View style={{ backgroundColor: C.card, borderRadius: rs.s(12), padding: rs.s(14), marginBottom: rs.s(14), borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.gold, fontWeight: 'bold', fontSize: rs.font(13) }}>My Evidence Chain ({myChain.length})</Text>
            <Text style={{ color: C.muted, fontSize: rs.font(10), marginTop: rs.s(4) }}>
              Dual-signed completions kept on this phone, hash-chained and anchored to Kaspa block headers (DAA score + MuHash snapshot of the whole chain at that moment). Survives pruning. Share the bundle and anyone can verify it on request.
            </Text>
            {myChain.length === 0 ? (
              <Text style={{ color: C.muted, fontSize: rs.font(11), marginTop: rs.s(8) }}>No records yet {'\\u2014'} completed agreements land here automatically.</Text>
            ) : myChain.map((r: any, i: number) => {
              const _a: any = r && r.anchor;
              return (
                <View key={i} style={{ marginTop: rs.s(8), borderTopWidth: i ? 1 : 0, borderTopColor: C.border, paddingTop: rs.s(6) }}>
                  <Text style={{ color: C.text, fontSize: rs.font(11), fontWeight: 'bold' }}>{String(r.agrId || r.agreementId || 'record ' + (i + 1))}  <Text style={{ color: C.primary }}>{String(r.status || r.outcome || '')}</Text></Text>
                  <Text style={{ color: C.muted, fontSize: rs.font(9), marginTop: rs.s(2) }}>
                    {_a ? 'DAA ' + String(_a.daaScore || _a.daa || '?') + '  tx ' + String(_a.txId || _a.releaseTxId || _a.txid || '').slice(0, 16) + (_a.header ? '  MuHash \\u2713' : '  header pending') : 'anchor pending'}
                  </Text>
                </View>
              );
            })}
            <View style={{ flexDirection: 'row', gap: rs.s(8), marginTop: rs.s(10) }}>
              <TouchableOpacity onPress={handleChainVerify} style={{ flex: 1, borderWidth: 1, borderColor: C.primary, borderRadius: rs.s(8), paddingVertical: rs.s(8), alignItems: 'center' }}>
                <Text style={{ color: C.primary, fontSize: rs.font(11), fontWeight: 'bold' }}>{chainVerdict || 'Verify Chain'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleChainCopy} style={{ flex: 1, borderWidth: 1, borderColor: C.gold, borderRadius: rs.s(8), paddingVertical: rs.s(8), alignItems: 'center' }}>
                <Text style={{ color: C.gold, fontSize: rs.font(11), fontWeight: 'bold' }}>{chainCopied ? 'Copied' : 'Copy Bundle'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAnchorFetch} style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: rs.s(8), paddingVertical: rs.s(8), alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontSize: rs.font(11), fontWeight: 'bold' }}>Fetch Anchors</Text>
              </TouchableOpacity>
            </View>
          </View>
`,
  ],
];

let ok = true;
for (let i = 0; i < edits.length; i++) {
  const c = s.split(edits[i][0]).length - 1;
  if (c !== 1) { console.error('ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Phone Proof shows the on-phone evidence chain (verify / copy bundle / fetch anchors)');
