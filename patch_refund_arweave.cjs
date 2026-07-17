// patch_refund_arweave.cjs
//
// The co-signed refund is the seller's only exit, and it lives in exactly one
// place: kv_refund_<agrId> in SecureStore on the seller's phone. New phone,
// migration, factory reset, or the 2048-byte SecureStore limit that Expo is
// already warning about on this exact key -> the refund is gone and the
// collateral becomes 2-of-2-only forever.
//
// Fix: publish it to Arweave before the collateral moves (same rule as the
// read-back), and fall back to Arweave on reclaim when the local key misses.
//
// Safe to publish: the blob is a co-signed tx that pays the seller and nobody
// else. A stranger who broadcasts it hands the seller their money back. The
// kill tx still trumps it, because that is decided by consensus - whether the
// refund's input is still unspent - not by who holds a copy.
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
let applied = 0;

const rx = (lines) =>
  new RegExp(lines.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[ \\t]*\\r?\\n[ \\t]*'));

function countRx(pat) {
  return (s.match(new RegExp(pat.source, 'g')) || []).length;
}

// ---------------- 1. WRITE: inscribe before broadcast ----------------
const A1 = "if (!_verify) { Alert.alert('Storage Failed', 'Could not save the signed refund. Nothing was sent.'); setIsLoading(false); return; }";
{
  const n = s.split(A1).length - 1;
  if (n !== 1) { console.error(`SKIP [write] anchor count = ${n}, expected 1`); }
  else {
    const i = s.indexOf(A1);
    const ls = s.lastIndexOf('\n', i) + 1;
    const ind = s.slice(ls, i);
    if (/\S/.test(ind)) { console.error('SKIP [write] anchor not at line start'); }
    else {
      const block = [
        A1,
        '// ARWEAVE DURABILITY: SecureStore dies with the phone; the refund must not.',
        '// Blocking on purpose - a refund that exists only on this device is the',
        '// failure this whole track was built to prevent.',
        'try {',
        '  const _arBody = JSON.stringify({',
        '    txBody: _agg.txBody,',
        '    lockTime: _lockTime,',
        '    predictedTxId: _p.predictedTxId,',
        '    amountSompi: _p.amountSompi,',
        '    frostAddr: _p.frostAddr,',
        '    network: _p.network,',
        '    agrId: _agrId,',
        '    createdAt: Date.now(),',
        '  });',
        '  const _arRes = await uploadToIrys(_arBody, [',
        "    { name: 'App-Name', value: 'KasVillage' },",
        "    { name: 'Content-Type', value: 'application/json' },",
        "    { name: 'KV-Type', value: 'refund' },",
        "    { name: 'KV-Status', value: 'Refund' },",
        "    { name: 'KV-AgreementId', value: _agrId },",
        "    { name: 'KV-Pubkey', value: String(_p.sellerPubkey || '') },",
        "    { name: 'KV-Counterparty', value: String(_p.buyerPubkey || '') },",
        "    { name: 'KV-FrostAddress', value: String(_p.frostAddr || '') },",
        "    { name: 'KV-Network', value: String(_p.network || 'testnet-10') },",
        "    { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },",
        '  ]);',
        '  if (!_arRes || !_arRes.success || !_arRes.txId) {',
        "    console.warn('[Refund] Arweave inscription FAILED:', _arRes && _arRes.error);",
        "    Alert.alert('Backup Failed', 'Could not publish the signed refund to Arweave, so it would only exist on this phone. Nothing was sent - try again.');",
        '    setIsLoading(false); return;',
        '  }',
        "  console.log('[Refund] Inscribed to Arweave:', _arRes.txId, '- survives phone loss.');",
        '} catch (_arE) {',
        "  console.warn('[Refund] Arweave inscription threw:', _arE);",
        "  Alert.alert('Backup Failed', 'Could not publish the signed refund to Arweave. Nothing was sent.');",
        '  setIsLoading(false); return;',
        '}',
      ].map(l => ind + l).join(NL);
      s = s.slice(0, ls) + block + s.slice(i + A1.length);
      applied++; console.log('APPLIED [write] refund -> Arweave before broadcast');
    }
  }
}

// ---------------- 2. READ: Arweave fallback on reclaim ----------------
const P2 = rx([
  "const _rj = await SecureStore.getItemAsync('kv_refund_' + _agrId);",
  "if (!_rj) { Alert.alert('No Reclaim Stored', 'There is no co-signed refund for this agreement. Your collateral can only be released by mutual signature.'); return; }",
]);
if (countRx(P2) !== 1) { console.error(`SKIP [read] anchor count = ${countRx(P2)}, expected 1`); }
else {
  const m = s.match(P2);
  const i = s.indexOf(m[0]);
  const ls = s.lastIndexOf('\n', i) + 1;
  const ind = s.slice(ls, i);
  if (/\S/.test(ind)) { console.error('SKIP [read] anchor not at line start'); }
  else {
    const block = [
      "let _rj = await SecureStore.getItemAsync('kv_refund_' + _agrId);",
      'if (!_rj) {',
      '  // Not on this phone. Paste + seed should be enough, so ask Arweave.',
      '  try {',
      '    const _q = \'{ transactions(first: 1, tags: [{ name: "KV-AgreementId", values: ["\' + _agrId + \'"] }, { name: "KV-Type", values: ["refund"] }], sort: HEIGHT_DESC) { edges { node { id } } } }\';',
      "    const _qr = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: _q }) });",
      '    const _qj = _qr.ok ? await _qr.json() : null;',
      "    const _arId = _qj && _qj.data && _qj.data.transactions && _qj.data.transactions.edges && _qj.data.transactions.edges[0] ? _qj.data.transactions.edges[0].node.id : '';",
      '    if (_arId) {',
      "      const _dr = await fetch('https://arweave.net/' + _arId);",
      '      if (_dr.ok) {',
      '        _rj = await _dr.text();',
      "        console.log('[Reclaim] Refund recovered from Arweave:', _arId);",
      "        try { await SecureStore.setItemAsync('kv_refund_' + _agrId, _rj); } catch {}",
      '      }',
      '    }',
      "  } catch (_arQe) { console.warn('[Reclaim] Arweave refund lookup failed:', _arQe); }",
      '}',
      "if (!_rj) { Alert.alert('No Reclaim Stored', 'There is no co-signed refund for this agreement, on this phone or on Arweave. Your collateral can only be released by mutual signature.'); return; }",
    ].map(l => ind + l).join(NL);
    s = s.slice(0, ls) + block + s.slice(i + m[0].length);
    applied++; console.log('APPLIED [read] Arweave fallback on reclaim');
  }
}

if (applied !== 2) { console.error(`ABORT - ${applied}/2 applied, file NOT written`); process.exit(1); }

// ---------------- post-conditions ----------------
const post = [
  ["const _arRes = await uploadToIrys(_arBody", 1],
  ["let _rj = await SecureStore.getItemAsync('kv_refund_' + _agrId);", 1],
  // the old const form must be gone
  ["const _rj = await SecureStore.getItemAsync('kv_refund_' + _agrId);", 0],
  // write must still be ahead of the broadcast
  ["const _br = await broadcastPreparedTx(_p.preparedTx, _p.network);", 1],
];
for (const [p, want] of post) {
  const got = s.split(p).length - 1;
  if (got !== want) { console.error(`ABORT post-condition "${p}" = ${got}, want ${want}`); process.exit(1); }
}
// ordering check: inscription must precede the broadcast
const iInscribe = s.indexOf('const _arRes = await uploadToIrys(_arBody');
const iBroadcast = s.indexOf('const _br = await broadcastPreparedTx(_p.preparedTx, _p.network);');
if (!(iInscribe > 0 && iBroadcast > iInscribe)) {
  console.error('ABORT - inscription is not ahead of the funding broadcast');
  process.exit(1);
}

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
console.log('');
console.log('Order is now: aggregate -> SecureStore -> read-back -> Arweave -> broadcast.');
console.log('An Arweave outage now blocks funding. That is the trade: availability');
console.log('for durability. The read-back at 4072 already set that precedent.');
console.log('');
console.log('STILL OPEN (not this patch):');
console.log('  - Kill-Gate trusts seller-supplied predictedTxId with nothing');
console.log('    cross-checking it against the refund template input.');
console.log('  - Kill tx is clipboard-only, and 4085 deletes the pending blob');
console.log('    before 4091 copies it. Miss the alert and it is gone.');
console.log('  - lockTime = currentDAA + N is stamped at freeze, so the seller');
console.log('    window burns while the buyer sits on the co-signature.');
