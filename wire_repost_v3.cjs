// wire_repost_v3.cjs — keeper v3: repost replays the CONTENT, not just the
// signpost.
//  payload_publish.ts: repostStrip(keeper, storeAddress, records) - replays
//    the author's signed records (store/dapp/page/game record + cfg chunks)
//    back to the store address, 1 KAS each. Signatures stay valid; the dust
//    lands at an address the AUTHOR controls (it adds to the live pledge and
//    the author can sweep it later).
//  VillageMailbox.tsx: runRepost reads the strip via fetchRecords - chain
//    first, DEVICE CACHE when the chain already pruned it - dedupes replays
//    (same record => same t/seq/hash), replays the strip, then re-announces.
//    So a keeper's phone can RESURRECT pruned content onto the chain.
const fs = require('fs');

const jobs = [
  {
    f: 'payload_publish.ts',
    marker: 'KV_REPOST_STRIP',
    edits: [
      [
`  console.log('[Repost]', String(((record as any).d && (record as any).d.name) || '').slice(0, 24), '-> registry', regAddr.slice(0, 24), 'by', keeper.address.slice(0, 24));
  return res;
}`,
`  console.log('[Repost]', String(((record as any).d && (record as any).d.name) || '').slice(0, 24), '-> registry', regAddr.slice(0, 24), 'by', keeper.address.slice(0, 24));
  return res;
}

/** KV_REPOST_STRIP: replay a listing's CONTENT records (store/dapp record +
 *  cfg chunks) back to its store address, signatures untouched. The 1-KAS
 *  dust per record lands at an address the AUTHOR controls - it adds to the
 *  listing's live pledge and the author can sweep it later. */
export async function repostStrip(keeper: OwnerKeys, storeAddress: string, records: KvRecord[]) {
  const out: string[] = [];
  for (const rec of records) {
    try {
      const res: any = await sendKaspaViaRest({
        senderAddress: keeper.address,
        recipientAddress: storeAddress,
        amountSompi: ANNOUNCE_SOMPI,
        privateKeyHex: keeper.privateKeyHex,
        network: keeper.network,
        payload: buildPayloadHex(rec),
      });
      if (res && res.success === false) throw new Error(String(res.error || 'send failed'));
      const _t = String((res && (res.txid || res.transactionId || res.txId)) || '');
      out.push(_t);
      console.log('[RepostStrip]', String((rec as any).k), '->', storeAddress.slice(0, 24), _t.slice(0, 16));
    } catch (e) { console.warn('[RepostStrip] record failed:', (rec as any).k, e); }
  }
  return out;
}`,
      ],
    ],
  },
  {
    f: 'VillageMailbox.tsx',
    marker: 'KV_REPOST_V3',
    edits: [
      [
`      const { repostRecord } = require('./payload_publish');
      const r: any = await repostRecord({ privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any }, rec, kind);
      if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
      Alert.alert('Reposted \\u2713', 'You re-announced this listing to the chain (1 KAS). Your wallet is now its keeper - tips for keeping it alive come to you.');`,
`      const { repostRecord, repostStrip } = require('./payload_publish');
      const _keeper = { privateKeyHex: priv, pubkeyHex: pub, address: sender, network: 'testnet-10' as any };
      // KV_REPOST_V3: replay the CONTENT first (store record + cfg chunks) so
      // the body survives pruning, not just the announce. fetchRecords falls
      // back to the device cache, so this also revives content the chain has
      // already pruned - the phone puts it back.
      let _stripN = 0;
      try {
        const { fetchRecords } = require('./kaspa_payload');
        const _addr = String(entry.arweaveTx || entry.id || '');
        const _wrapped: any[] = _addr ? await fetchRecords(_addr, 'testnet-10', 100) : [];
        const _seen: any = {};
        const _strip: any[] = [];
        for (const _w of _wrapped) {
          const _r0: any = _w && _w.record;
          if (!_r0 || !_r0.sig) continue;
          if (['store', 'cfg', 'dapp', 'page', 'game'].indexOf(String(_r0.k)) < 0) continue;
          if (entry.ownerPubkey && String(_r0.o) !== String(entry.ownerPubkey)) continue;
          const _id0 = String(_r0.k) + '|' + String(_r0.t) + '|' + String((_r0.d && _r0.d.seq !== undefined ? _r0.d.seq : '')) + '|' + String((_r0.d && _r0.d.h) || '');
          if (_seen[_id0]) continue;
          _seen[_id0] = 1;
          _strip.push(_r0);
        }
        if (_strip.length) { const _txs: string[] = await repostStrip(_keeper, _addr, _strip); _stripN = _txs.length; }
        console.log('[Repost] strip:', _strip.length, 'record(s), replayed:', _stripN);
      } catch (_e) { console.warn('[Repost] strip replay failed (announce continues):', _e); }
      const r: any = await repostRecord(_keeper, rec, kind);
      if (r && r.success === false) throw new Error(String(r.error || 'send failed'));
      Alert.alert('Reposted \\u2713', 'Re-announced to the chain' + (_stripN ? ' + ' + _stripN + ' content record(s) replayed' : '') + ' (' + (1 + _stripN) + ' KAS total). Your wallet is now its keeper - tips come to you.');`,
      ],
    ],
  },
];

let ok = true;
const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8');
  const CRLF = s.includes('\r\n');
  if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (let i = 0; i < j.edits.length; i++) {
    const c = s.split(j.edits[i][0]).length - 1;
    if (c !== 1) { console.error(j.f + ' ANCHOR ' + (i + 1) + ' count = ' + c + ' - expected 1.'); ok = false; }
  }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - repost v3: content strip replay (prune revival from device cache).');
