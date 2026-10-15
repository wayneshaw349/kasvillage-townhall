// wire_frost_kaspa.cjs — frost-agreement records move from dead Arweave to
// the Kaspa payload rail. townhall_client.ts only; all three function
// signatures are preserved so the ~11 call sites in NeighborAgreement.tsx
// need no changes.
//
//  1. inscribeAgreementToArweave: body re-pointed. The signed agreement
//     record (k:'agreement') rides a 1-KAS send to TWO addresses:
//       - rendezvous: deriveStoreKeys('KV_AGR_' + agreementId, 0, net)
//         — both parties compute the same address from the id alone, so
//         each finds the other with one fetchRecords call. Key is public
//         by construction, so the 1 KAS is parked, not burned.
//       - global feed: deriveStoreKeys('KV_AGR_GLOBAL_' + net, 0, net)
//         — serves list queries (fail-soft; rendezvous is the truth).
//     Raw frostR is STRIPPED from the on-chain record (hash only), same
//     defense-in-depth the Arweave tags had.
//  2. queryCounterpartyAgreed: early-return Kaspa read of the rendezvous
//     address — k:'agreement', signature verified, o === counterparty,
//     status Agreed/Agreed-Send, optional frostAddress match.
//  3. queryAgreementsFromArweave: early-return Kaspa read of the global
//     feed, filtered by status/pubkey/counterparty, newest status per
//     (agreementId, party) wins. Returns the full agreement objects.
// Old Arweave bodies are left in place below the early returns (dead code,
// zero network calls) to keep the patch anchors small and reversible.
const fs = require('fs');
const F = 'townhall_client.ts';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes('KV_FROST_KASPA')) { console.log('already patched'); process.exit(0); }

const edits = [
  // 1. inscribe tail: uploadToIrys -> dual Kaspa sends
  [
`  const payload = JSON.stringify(agreement);
  console.log('[Arweave] Inscribing agreement:', agreement.agreementId, '(' + payload.length + ' bytes)');
  return uploadToIrys(payload, tags);
}`,
`  // KV_FROST_KASPA: agreement record -> Kaspa payload rail (Arweave dead).
  void tags;
  try {
    const { deriveStoreKeys } = require('./payload_publish');
    const { signRecord, buildPayloadHex } = require('./kaspa_payload');
    const { sendKaspaViaRest } = require('./kaspa_rest_tx');
    const { _kvResolvePrivHex } = require('./proposal_share');
    const SecureStore = require('expo-secure-store');
    const _net: any = agreement.network || 'testnet-10';
    const _priv = await _kvResolvePrivHex();
    const _addr = (await SecureStore.getItemAsync('kv_kaspa_address')) || (await SecureStore.getItemAsync('kaspa_address')) || '';
    if (!_priv || !_addr) throw new Error('wallet keys unavailable');
    const _d: any = { ...agreement };
    delete _d.frostR; // raw R never leaves the device; hash only (same rule the tags had)
    if (agreement.frostR) { const _s = require('@noble/hashes/sha256').sha256(new TextEncoder().encode(agreement.frostR)); _d.frostRHash = require('@noble/hashes/utils').bytesToHex(_s).slice(0, 32); }
    const _rec = signRecord({ k: 'agreement', v: 1, o: agreement.pubkey, t: Date.now(), d: _d } as any, _priv);
    const _hex = buildPayloadHex(_rec);
    const _rdv = deriveStoreKeys('KV_AGR_' + agreement.agreementId, 0, _net).address;
    const _feed = deriveStoreKeys('KV_AGR_GLOBAL_' + _net, 0, _net).address;
    const _r1: any = await sendKaspaViaRest({ senderAddress: _addr, recipientAddress: _rdv, amountSompi: 100_000_000n, privateKeyHex: _priv, network: _net, payload: _hex });
    let _r2: any = null;
    try { _r2 = await sendKaspaViaRest({ senderAddress: _addr, recipientAddress: _feed, amountSompi: 100_000_000n, privateKeyHex: _priv, network: _net, payload: _hex }); } catch (_e) { console.warn('[Agreement] global feed post failed (rendezvous OK)'); }
    const _tx = String((_r1 && (_r1.txid || _r1.transactionId || _r1.txId)) || '');
    console.log('[Agreement] rendezvous', _rdv.slice(0, 28), 'tx', _tx.slice(0, 16), '| feed tx', String((_r2 && (_r2.txid || _r2.transactionId || _r2.txId)) || 'skipped').slice(0, 16));
    return { success: true, id: _tx, url: 'kaspa:' + _tx } as any;
  } catch (e: any) {
    console.warn('[Agreement] Kaspa inscribe failed:', e && e.message);
    return { success: false, error: String((e && e.message) || e) } as any;
  }
}`,
  ],
  // 2. counterparty check: early-return rendezvous read
  [
`}): Promise<boolean> {
  if (!opts.agreementId || !opts.counterpartyPubkey) return false;`,
`}): Promise<boolean> {
  if (!opts.agreementId || !opts.counterpartyPubkey) return false;
  // KV_FROST_KASPA: read the rendezvous address on Kaspa (Arweave dead).
  try {
    const { fetchRecords, verifyRecord } = require('./kaspa_payload');
    const { deriveStoreKeys } = require('./payload_publish');
    const _net = 'testnet-10';
    const _rdv = deriveStoreKeys('KV_AGR_' + opts.agreementId, 0, _net).address;
    const _recs: any[] = await fetchRecords(_rdv, _net, 50);
    for (const _a of _recs) {
      const _r: any = _a.record;
      if (!_r || _r.k !== 'agreement' || !_r.d) continue;
      if (String(_r.d.agreementId) !== opts.agreementId) continue;
      if (String(_r.o) !== opts.counterpartyPubkey) continue;
      if (['Agreed', 'Agreed-Send'].indexOf(String(_r.d.status)) < 0) continue;
      if (opts.frostAddress && String(_r.d.frostAddress || '') !== opts.frostAddress) continue;
      if (!verifyRecord(_r)) continue;
      console.log('[Agreement] Counterparty agreed! tx:', _a.txid);
      return true;
    }
    return false;
  } catch (_e) { console.warn('[Agreement] rendezvous read failed:', _e); return false; }`,
  ],
  // 3. agreement list: early-return global feed read
  [
`  network?: string;
}): Promise<any[]> {
  const tagFilters: string[] = [`,
`  network?: string;
}): Promise<any[]> {
  // KV_FROST_KASPA: global agreement feed on Kaspa (Arweave dead).
  try {
    const { fetchRecords, verifyRecord } = require('./kaspa_payload');
    const { deriveStoreKeys } = require('./payload_publish');
    const _net = (opts && opts.network) || 'testnet-10';
    const _feed = deriveStoreKeys('KV_AGR_GLOBAL_' + _net, 0, _net).address;
    const _recs: any[] = await fetchRecords(_feed, _net, 100);
    const _out: any[] = [];
    const _seen: any = {};
    for (const _a of _recs) {
      const _r: any = _a.record;
      if (!_r || _r.k !== 'agreement' || !_r.d || !verifyRecord(_r)) continue;
      const _d: any = _r.d;
      if (opts && opts.status && String(_d.status) !== opts.status) continue;
      if (opts && opts.pubkey && String(_r.o) !== opts.pubkey) continue;
      if (opts && opts.counterparty && String(_d.counterpartyPubkey || '') !== opts.counterparty) continue;
      const _key = String(_d.agreementId) + '|' + String(_r.o);
      if (_seen[_key]) continue; // newest-first: latest status per party wins
      _seen[_key] = 1;
      _out.push({ ..._d, pubkey: _r.o, txId: _a.txid, t: _r.t });
    }
    return _out;
  } catch (_e) { console.warn('[Agreement] feed read failed:', _e); return []; }
  const tagFilters: string[] = [`,
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
console.log('patched: frost agreements post + read on Kaspa (rendezvous + global feed)');
