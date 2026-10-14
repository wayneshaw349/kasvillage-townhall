// wire_abstract_kaspa.cjs — handleSubmitAbstract off dead Arweave (uploadToIrys)
// onto the proven Kaspa rail, mirroring the dapp publish flow:
//   publish-side scan -> 1 KAS pledge anchor (publishContent) -> abstract as
//   config chunks -> Academic announce with configHash + coords + DKIM stamp.
// primaryLink = repositoryUrl; qaChannel/qaHandle ride inside the chunks.
// Non-fatal: the abstract stays saved locally (saveAbstract) if chain fails.
// The pledge nonce is stored per-abstract (kv_abs_nonce_<id>) so the pledge
// can be swept later (withdraw = delist), same model as stores.
const fs = require('fs');
const F = 'Workspace.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_ABSTRACT_KASPA')) { console.log('already patched'); process.exit(0); }

const A = `    await saveAbstract(newAbstract);
    // Inscribe to Arweave
    try {
      const { uploadToIrys } = await import('./arweave_upload');
      await uploadToIrys(JSON.stringify(newAbstract), [
        { name: 'App-Name', value: 'KasVillage' },
        { name: 'KV-Type', value: 'Abstract' },
        { name: 'KV-AbstractId', value: newAbstract.id },
        { name: 'KV-Domain', value: newAbstract.institutionDomain },
        { name: 'KV-Discipline', value: abstractDiscipline },
        { name: 'KV-VideoUrl', value: abstractVideoUrl },
        { name: 'KV-QAChannel', value: qaChannel },
        { name: 'Content-Type', value: 'application/json' },
      ]);
      console.log('[Academic] Abstract inscribed to Arweave');
    } catch (e) { console.warn('[Academic] Arweave failed:', e); }`;

const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }

const B = `    await saveAbstract(newAbstract);
    // KV_ABSTRACT_KASPA: Kaspa rail replaces dead Arweave - pledge anchor ->
    // abstract as config chunks -> Academic announce (DKIM stamp + coords).
    // Non-fatal: the abstract stays saved locally if the chain publish fails.
    try {
      const { publishContent, announceToRegistry } = require('./payload_publish');
      const { publishConfigChunks } = require('./config_chunks');
      const { _kvResolvePrivHex } = require('./proposal_share');
      const { scanObject, reasonMessage } = require('./content_filter');
      const _scan = scanObject(newAbstract);
      if (!_scan.ok) { setIsLoading(false); Alert.alert('Cannot publish', reasonMessage(_scan.reason)); return; }
      const _priv = await _kvResolvePrivHex();
      const _addr = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '';
      if (!_priv || !_addr) throw new Error('wallet keys unavailable');
      const _pub2 = bytesToHex(secp256k1.getPublicKey(hexToBytes(_priv), true));
      const _owner = { privateKeyHex: _priv, pubkeyHex: _pub2, address: _addr, network: 'testnet-10' as any };
      const _nonce = 7000 + (Math.floor(Date.now() / 1000) % 1000000); // unique per abstract; saved below for pledge withdrawal
      const _pubRes: any = await publishContent(_owner, 'store', { name: newAbstract.title, category: 'Academic', abstractId: newAbstract.id }, _nonce, 100_000_000n);
      if (!_pubRes || _pubRes.success === false) throw new Error('abstract publish failed: ' + (_pubRes && _pubRes.error));
      try { const AS = require('@react-native-async-storage/async-storage').default; AS.setItem('kv_abs_nonce_' + newAbstract.id, String(_nonce)); } catch {}
      const _ck: any = await publishConfigChunks(_owner, _pubRes.storeAddress, newAbstract);
      if (!_ck.success) console.warn('[Academic] abstract chunks failed (announce continues):', _ck.error);
      let _absCoords: any = undefined;
      try {
        let lo = Number.MAX_SAFE_INTEGER, hi = 0, pl = 0;
        const ur = await fetch('https://api-tn10.kaspa.org/addresses/' + encodeURIComponent(_pubRes.storeAddress) + '/utxos');
        for (const u of (await ur.json()) || []) {
          const dd = Number(u.utxoEntry?.blockDaaScore || u.blockDaaScore || 0);
          if (dd > 0) { if (dd < lo) lo = dd; if (dd > hi) hi = dd; }
          pl += Number(u.utxoEntry?.amount || u.amount || 0);
        }
        if (hi > 0) _absCoords = { pledge_kas: Math.round(pl / 1e7) / 10, daa_from: Math.max(0, Math.max(lo, hi - 14400) - 600), daa_to: hi + 600 };
      } catch {}
      const _dk = await SecureStore.getItemAsync('kv_dkim_domain');
      const _ann: any = await announceToRegistry(_owner, _pubRes.storeAddress, newAbstract.title, 'Academic', 'store', { primaryLink: newAbstract.repositoryUrl, configHash: _ck.hash, coords: _absCoords, ...(_dk ? { dkim: true, dkimDomain: _dk } : {}) } as any);
      if (!_ann || _ann.success === false) console.warn('[Academic] announce failed (abstract still local):', _ann && _ann.error);
      else console.log('[Academic] abstract on Kaspa - addr:', _pubRes.storeAddress, 'cfgHash:', String(_ck.hash || '').slice(0, 16));
    } catch (e) { console.warn('[Academic] Kaspa publish failed (abstract saved locally):', e); }`;

s = s.split(A).join(B); // split/join: immune to $-pattern expansion
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: abstracts publish to Kaspa (pledge + chunks + Academic announce w/ DKIM)');
