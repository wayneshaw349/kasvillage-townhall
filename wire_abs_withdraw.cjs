// wire_abs_withdraw.cjs — hard delist for the blank test listings. Button in
// the Submit tab under Re-announce: sweeps the pledge of every UNTITLED
// saved abstract (kv_abstracts entries with no title, nonce in
// kv_abs_nonce_<id>) back to the wallet via withdrawPledge. pledge=0 =>
// dropped from every directory permanently. Titled abstracts are skipped,
// so the live listing cannot be hit by accident.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_ABS_WITHDRAW')) { console.log('already patched'); process.exit(0); }

const edits = [
  // 1. handler after handleReannounceAbstracts
  [
`    } catch (e: any) { Alert.alert('Re-announce failed', String(e?.message || e)); }
    setIsLoading(false);
  };`,
`    } catch (e: any) { Alert.alert('Re-announce failed', String(e?.message || e)); }
    setIsLoading(false);
  };

  // KV_ABS_WITHDRAW: hard delist - sweep pledges of UNTITLED test abstracts
  const handleWithdrawUntitled = async () => {
    try {
      setIsLoading(true);
      const AS = require('@react-native-async-storage/async-storage').default;
      const { withdrawPledge } = require('./payload_publish');
      const { _kvResolvePrivHex } = require('./proposal_share');
      const _priv = await _kvResolvePrivHex();
      const _addr = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '';
      if (!_priv || !_addr) throw new Error('wallet keys unavailable');
      const _pub2 = bytesToHex(secp256k1.getPublicKey(hexToBytes(_priv), true));
      const _owner = { privateKeyHex: _priv, pubkeyHex: _pub2, address: _addr, network: 'testnet-10' as any };
      const _list: any[] = JSON.parse((await SecureStore.getItemAsync('kv_abstracts')) || '[]');
      let _ok = 0, _skip = 0;
      for (const _a of _list) {
        if (String(_a.title || '').trim()) { _skip++; continue; } // titled listings are never touched
        const _nS = await AS.getItem('kv_abs_nonce_' + _a.id);
        if (!_nS) { _skip++; continue; }
        const _r: any = await withdrawPledge(_owner, parseInt(_nS, 10));
        const _t = String((_r && (_r.txid || _r.transactionId || _r.txId)) || (_r === null ? 'already-0' : ''));
        if (_r === null || (_r && _r.success !== false)) _ok++;
        console.log('[Academic] withdraw', _a.id, '->', _t.slice(0, 16));
      }
      Alert.alert('Pledges swept', _ok + ' untitled abstract(s) hard-delisted - pledge back in your wallet. ' + _skip + ' kept.');
    } catch (e: any) { Alert.alert('Withdraw failed', String(e?.message || e)); }
    setIsLoading(false);
  };`,
  ],
  // 2. button under Re-announce
  [
`<Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Re-announce My Abstracts (~1 KAS each)</Text>
                    </TouchableOpacity>`,
`<Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Re-announce My Abstracts (~1 KAS each)</Text>
                    </TouchableOpacity>
                    {/* KV_ABS_WITHDRAW */}
                    <TouchableOpacity style={{ backgroundColor: '#7f1d1d', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 }} onPress={handleWithdrawUntitled} disabled={isLoading}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Clean Up Untitled Abstracts (withdraw pledges)</Text>
                    </TouchableOpacity>`,
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
console.log('patched: Clean Up Untitled Abstracts button (pledge sweep = hard delist)');
