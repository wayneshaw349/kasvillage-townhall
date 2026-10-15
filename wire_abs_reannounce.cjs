// wire_abs_reannounce.cjs — "Re-announce My Abstracts" button in the Submit
// tab. Loops every saved abstract (kv_abstracts) that has a pledge nonce
// (kv_abs_nonce_<id>), re-derives its store address, recomputes the cfgHash,
// fetches fresh coords, and re-announces with title + DKIM stamp. Chunks
// untouched - this is the heartbeat, ~1 KAS per abstract. Also fixes the
// blank-name listing: the re-announce carries the locally saved title.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_ABS_REANNOUNCE')) { console.log('already patched'); process.exit(0); }

const edits = [];

// --- 1. handler, right after handleSubmitAbstract ends ---
edits.push([
  "    setAttestation3(false);\n    setIsLoading(false);\n  };",
  `    setAttestation3(false);
    setIsLoading(false);
  };

  // KV_ABS_REANNOUNCE: heartbeat - re-advertise saved abstracts, chunks untouched (~1 KAS each)
  const handleReannounceAbstracts = async () => {
    try {
      setIsLoading(true);
      const AS = require('@react-native-async-storage/async-storage').default;
      const { announceToRegistry, deriveStoreKeys } = require('./payload_publish');
      const { _kvResolvePrivHex } = require('./proposal_share');
      const _priv = await _kvResolvePrivHex();
      const _addr = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '';
      if (!_priv || !_addr) throw new Error('wallet keys unavailable');
      const _pub2 = bytesToHex(secp256k1.getPublicKey(hexToBytes(_priv), true));
      const _owner = { privateKeyHex: _priv, pubkeyHex: _pub2, address: _addr, network: 'testnet-10' as any };
      const _list: any[] = JSON.parse((await SecureStore.getItemAsync('kv_abstracts')) || '[]');
      const _dk = await SecureStore.getItemAsync('kv_dkim_domain');
      let _ok = 0, _skip = 0;
      for (const _a of _list) {
        const _nS = await AS.getItem('kv_abs_nonce_' + _a.id);
        if (!_nS) { _skip++; continue; }
        const _st = deriveStoreKeys(_priv, parseInt(_nS, 10), _owner.network).address;
        let _h = '';
        try { const _cc = require('./config_chunks'); if (_cc.configToChunkData) _h = _cc.configToChunkData(_a).hash; } catch {}
        let _c: any = undefined;
        try {
          let lo = Number.MAX_SAFE_INTEGER, hi = 0, pl = 0;
          const ur = await fetch('https://api-tn10.kaspa.org/addresses/' + encodeURIComponent(_st) + '/utxos');
          for (const u of (await ur.json()) || []) {
            const dd = Number(u.utxoEntry?.blockDaaScore || u.blockDaaScore || 0);
            if (dd > 0) { if (dd < lo) lo = dd; if (dd > hi) hi = dd; }
            pl += Number(u.utxoEntry?.amount || u.amount || 0);
          }
          if (hi > 0) _c = { pledge_kas: Math.round(pl / 1e7) / 10, daa_from: Math.max(0, Math.max(lo, hi - 14400) - 600), daa_to: hi + 600 };
        } catch {}
        const _an: any = await announceToRegistry(_owner, _st, String(_a.title || '').trim(), 'Academic', 'store', { primaryLink: _a.repositoryUrl, ...(_h ? { configHash: _h } : {}), coords: _c, ...(_dk ? { dkim: true, dkimDomain: _dk } : {}) } as any);
        if (_an && _an.success !== false) _ok++;
        console.log('[Academic] re-announce', _a.id, '->', _st.slice(0, 24), _an && _an.success !== false ? 'OK' : 'FAIL');
      }
      Alert.alert('Re-announced', _ok + ' abstract(s) re-advertised' + (_skip ? ', ' + _skip + ' skipped (no pledge nonce)' : '') + '. ~1 KAS each.');
    } catch (e: any) { Alert.alert('Re-announce failed', String(e?.message || e)); }
    setIsLoading(false);
  };`
]);

// --- 2. button under Submit Abstract ---
edits.push([
  "                      {isLoading ? <ActivityIndicator color=\"#fff\" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Submit Abstract</Text>}\n                    </TouchableOpacity>",
  "                      {isLoading ? <ActivityIndicator color=\"#fff\" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Submit Abstract</Text>}\n                    </TouchableOpacity>\n                    {/* KV_ABS_REANNOUNCE */}\n                    <TouchableOpacity style={{ backgroundColor: COLORS.stone600, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 }} onPress={handleReannounceAbstracts} disabled={isLoading}>\n                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Re-announce My Abstracts (~1 KAS each)</Text>\n                    </TouchableOpacity>"
]);

let ok = true;
for (let i = 0; i < edits.length; i++) {
  const c = s.split(edits[i][0]).length - 1;
  if (c !== 1) { console.error('ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const [a, b] of edits) s = s.split(a).join(b);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: Re-announce My Abstracts button + heartbeat handler');
