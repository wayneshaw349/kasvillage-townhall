// wire_evidence_seal.cjs — (1) proofs that outlive pruning + dev sales export, (2) store delist cache.
//
// kaspa_payload.ts
//   kvFetchEvidence(txid)  - archives what the node says about a tx: full tx JSON, the containing
//                            block's header + its full txid list, the accepting block's header.
//                            A verifier recomputes hashMerkleRoot / acceptedIdMerkleRoot with Kaspa's
//                            own tooling - we compute nothing, so nothing here can be subtly wrong.
//   kvSealEvidence()       - runs ~20s after app start: seals every sales-log grant and every Phone
//                            Proof release txid that has no evidence yet (stored kv_evidence_<txid>).
//                            Must run within ~30h of the tx - after pruning the node can't answer.
//   store delist cache     - rebuildDirectory keeps delists per registry on the device
//                            (kv_store_delist_cache_*), re-verified each load: mod/owner removals of
//                            stores, services, academics, dapps no longer fade after pruning.
// Workspace.tsx
//   EXPORT SALES           - seals what it can, then shares a JSON signed by the dev key:
//                            {devPub, sales:[{game,item,buyer(sha256),grantTx,proof,t,evidence}], sig}.
const fs = require('fs');

const LIB = `

// KV_EVIDENCE: archive the node's own answer about a tx so it can be checked after pruning
export async function kvFetchEvidence(txid: string, network: string = 'testnet-10'): Promise<any | null> {
  try {
    if (!/^[0-9a-f]{64}$/i.test(String(txid || ''))) return null;
    const api = String(network).indexOf('testnet') >= 0 ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
    const tr = await fetch(api + '/transactions/' + txid + '?resolve_previous_outpoints=no');
    if (!tr.ok) return null;
    const tx: any = await tr.json();
    const bh = Array.isArray(tx.block_hash) ? tx.block_hash[0] : tx.block_hash;
    const ah = tx.accepting_block_hash;
    if (!bh || !ah) return null; // not accepted yet - try again later
    const br = await fetch(api + '/blocks/' + bh + '?includeTransactions=true');
    const blk: any = br.ok ? await br.json() : null;
    const ar = await fetch(api + '/blocks/' + ah + '?includeTransactions=false');
    const acc: any = ar.ok ? await ar.json() : null;
    if (!blk || !acc) return null;
    const ids: string[] = (blk.verboseData && blk.verboseData.transactionIds) || (blk.transactions || []).map((t: any) => t && t.verboseData && t.verboseData.transactionId).filter(Boolean);
    const hashes: string[] = (blk.transactions || []).map((t: any) => t && t.verboseData && t.verboseData.hash).filter(Boolean);
    return {
      v: 1, network, txid, sealedAt: Date.now(),
      tx,
      block: { hash: bh, header: blk.header || null, txIds: ids, txHashes: hashes, includesTx: ids.indexOf(txid) >= 0 },
      accepting: { hash: ah, header: acc.header || null, verbose: acc.verboseData ? { blueScore: acc.verboseData.blueScore, selectedParentHash: acc.verboseData.selectedParentHash } : null },
    };
  } catch { return null; }
}

export async function kvSealEvidence(network: string = 'testnet-10'): Promise<{ sealed: number; pending: number }> {
  let sealed = 0, pending = 0;
  try {
    const AS = require('@react-native-async-storage/async-storage').default;
    const want: string[] = [];
    try { for (const e of JSON.parse((await AS.getItem('kv_sales_log')) || '[]')) if (e && e.grantTx) want.push(String(e.grantTx)); } catch {}
    try { const sr = require('./stat_records'); for (const r of (await sr.loadChain()) || []) if (r && r.anchor && r.anchor.releaseTxId) want.push(String(r.anchor.releaseTxId)); } catch {}
    for (const t of Array.from(new Set(want))) {
      if (await AS.getItem('kv_evidence_' + t)) continue;
      const ev = await kvFetchEvidence(t, network);
      if (ev) { await AS.setItem('kv_evidence_' + t, JSON.stringify(ev)); sealed++; } else pending++;
    }
    if (sealed || pending) console.log('[Evidence] sealed ' + sealed + ', pending ' + pending + ' (pending = not accepted yet, or already pruned)');
  } catch (e) { console.warn('[Evidence]', e); }
  return { sealed, pending };
}
try { setTimeout(() => { kvSealEvidence().catch(() => {}); }, 20000); } catch {}
`;

const DELIST_A = "      if (!p || (r.t || 0) > (p.t || 0)) delistByTarget.set(tgt, r);\n    }\n  }\n";
const DELIST_B = DELIST_A + `  // KV_STORE_DELIST_CACHE: delists survive pruning on this device (re-verified every load)
  try {
    const _DAS = require('@react-native-async-storage/async-storage').default;
    const _dck = 'kv_store_delist_cache_' + String(registryAddress).slice(-16);
    const _old: any[] = JSON.parse((await _DAS.getItem(_dck)) || '[]');
    for (const r of _old) {
      if (!r || r.k !== 'delist' || !r.d || !r.d.head || !verifyRecord(r)) continue;
      const tgt = String(r.d.head); const p = delistByTarget.get(tgt);
      if (!p || (r.t || 0) > (p.t || 0)) delistByTarget.set(tgt, r);
    }
    await _DAS.setItem(_dck, JSON.stringify(Array.from(delistByTarget.values())));
  } catch {}
`;

const EXPORT_FN = `  // KV_SALES_EXPORT: signed sales report for publishers / studios
  const exportSales = async () => {
    try {
      const kp = require('./kaspa_payload');
      gadd('sealing proofs\\u2026');
      const sr: any = await kp.kvSealEvidence('testnet-10');
      const _AS4 = require('@react-native-async-storage/async-storage').default;
      const log: any[] = JSON.parse((await _AS4.getItem('kv_sales_log')) || '[]');
      const sales: any[] = [];
      for (const e of log) { let ev = null; try { ev = JSON.parse((await _AS4.getItem('kv_evidence_' + e.grantTx)) || 'null'); } catch {} sales.push({ ...e, evidence: ev }); }
      const { _kvResolvePrivHex } = require('./proposal_share');
      const priv = await _kvResolvePrivHex();
      if (!priv) throw new Error('wallet key unavailable');
      const { schnorr } = require('@noble/curves/secp256k1');
      const body = { v: 1, kind: 'kasvillage-sales', network: 'testnet-10', devPub: bytesToHex(secp256k1.getPublicKey(hexToBytes(priv), true)), generatedAt: Date.now(), count: sales.length, buyers: Array.from(new Set(sales.map((x: any) => x.buyer))).length, sales };
      const msg = sha256(new TextEncoder().encode(JSON.stringify(body)));
      const report = { ...body, sig: bytesToHex(schnorr.sign(msg, hexToBytes(priv))) };
      gadd('sales export: ' + sales.length + ' deliveries, ' + body.buyers + ' unique buyers, ' + sales.filter((x: any) => x.evidence).length + ' with sealed evidence (' + sr.pending + ' pending)');
      await require('react-native').Share.share({ message: JSON.stringify(report) });
    } catch (e: any) { Alert.alert('Export failed', String((e && e.message) || e)); }
  };
`;

const jobs = [
  { f: 'kaspa_payload.ts', marker: 'KV_EVIDENCE', append: LIB, edits: [[DELIST_A, DELIST_B]] },
  { f: 'Workspace.tsx', marker: 'KV_SALES_EXPORT', edits: [
    ["  const runDelist = async (gameId: string) => {", EXPORT_FN + "  const runDelist = async (gameId: string) => {"],
    ["<TouchableOpacity onPress={setMyContact}",
     "<TouchableOpacity onPress={exportSales} style={{ borderWidth: 1, borderColor: '#7c3aed', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginRight: 6, alignItems: 'center' }}><Text style={{ color: '#7c3aed', fontWeight: '700', fontSize: 11 }}>EXPORT SALES</Text></TouchableOpacity>\n                <TouchableOpacity onPress={setMyContact}"],
  ] },
];
let ok = true; const staged = [];
for (const j of jobs) {
  let s = fs.readFileSync(j.f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
  if (s.includes(j.marker)) { console.log(j.f + ': already patched - skipping'); continue; }
  for (const [a] of j.edits) { const c = s.split(a).length - 1; if (c !== 1) { console.error(j.f + ' ANCHOR count ' + c + ' expected 1: ' + a.slice(0, 60).replace(/\n/g, ' ')); ok = false; } }
  staged.push({ ...j, s, CRLF });
}
if (!ok) { console.error('Aborting - nothing written.'); process.exit(1); }
for (const j of staged) {
  let s = j.s;
  for (const [a, b] of j.edits) s = s.split(a).join(b);
  if (j.append) s = s.replace(/\s*$/, '') + j.append;
  fs.writeFileSync(j.f, j.CRLF ? s.replace(/\n/g, '\r\n') : s);
  console.log(j.f + ': patched');
}
console.log('DONE - evidence sealing + signed sales export + store delist cache.');
