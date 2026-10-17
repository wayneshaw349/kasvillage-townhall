// fix_nonce_recover.cjs — recover missing pledge nonces (kv_abs_nonce_<id>).
// Publish computes nonce = 7000 + (floor(Date.now()/1000) % 1e6) moments after
// the abstract id (ABS_<ms>) is minted, but the save was fire-and-forget and
// can be lost. Rebuild it: walk candidates from the id's timestamp, derive each
// store address with your key, and accept the one that matches an address you
// announced on chain (or, failing that, one holding a live pledge). Runs at the
// start of Re-announce AND Clean Up Untitled, then saves the nonce for good.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_NONCE_RECOVER')) { console.log('already patched'); process.exit(0); }

const A1 = '  // KV_ABS_REANNOUNCE: heartbeat - re-advertise saved abstracts, chunks untouched (~1 KAS each)';
const B1 = `  // KV_NONCE_RECOVER: rebuild lost kv_abs_nonce_<id> from the abstract's mint time
  const kvRecoverAbsNonces = async (_priv: string, _list: any[]) => {
    try {
      const AS = require('@react-native-async-storage/async-storage').default;
      const { deriveStoreKeys, registryAddress } = require('./payload_publish');
      const { fetchRecords, getPledgeSompi } = require('./kaspa_payload');
      const missing: any[] = [];
      for (const _a of _list) { if (!(await AS.getItem('kv_abs_nonce_' + _a.id))) missing.push(_a); }
      if (!missing.length) return;
      const myPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(_priv), true));
      const mine = new Set<string>();
      try {
        const recs: any[] = await fetchRecords(registryAddress('store', 'testnet-10'), 'testnet-10', 100, 5);
        for (const w of recs) {
          const r: any = w && w.record;
          if (!r || r.k !== 'registry' || String(r.o) !== myPub || !r.d) continue;
          if (r.d.storeAddress) mine.add(String(r.d.storeAddress));
          if (Array.isArray(r.d.batch)) for (const it of r.d.batch) if (it && it.storeAddress) mine.add(String(it.storeAddress));
        }
      } catch {}
      for (const _a of missing) {
        const ms = Number(String(_a.id || '').replace(/^ABS_/, ''));
        if (!(ms > 0)) continue;
        const base = Math.floor(ms / 1000);
        let found = -1;
        for (let d = 0; d <= 90 && found < 0; d++) {
          const n = 7000 + ((base + d) % 1000000);
          if (mine.has(deriveStoreKeys(_priv, n, 'testnet-10').address)) found = n;
        }
        for (let d = 0; d <= 20 && found < 0; d++) {
          const n = 7000 + ((base + d) % 1000000);
          try { if ((await getPledgeSompi(deriveStoreKeys(_priv, n, 'testnet-10').address, 'testnet-10')) > 0n) found = n; } catch {}
        }
        if (found >= 0) { await AS.setItem('kv_abs_nonce_' + _a.id, String(found)); console.log('[Academic] nonce RECOVERED', _a.id, '->', found); }
        else console.log('[Academic] nonce not recoverable', _a.id, '(announce pruned and no live pledge)');
      }
    } catch (e) { console.log('[Academic] nonce recovery failed:', e); }
  };

` + A1;

const A2 = "      const _list: any[] = JSON.parse((await SecureStore.getItemAsync('kv_abstracts')) || '[]');";
const B2 = A2 + '\n      await kvRecoverAbsNonces(_priv, _list);';

const c1 = s.split(A1).length - 1;
const c2 = s.split(A2).length - 1;
if (c1 !== 1 || c2 !== 2) { console.error('ANCHOR counts: helper=' + c1 + ' (want 1), list=' + c2 + ' (want 2). Aborting.'); process.exit(1); }
s = s.split(A1).join(B1).split(A2).join(B2);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: lost pledge nonces auto-recover in Re-announce + Clean Up');
