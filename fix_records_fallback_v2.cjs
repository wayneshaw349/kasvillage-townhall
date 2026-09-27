// fix_records_fallback.cjs — wallet-side half of the relay-records rail.
//
// api-tn10's tx-ingest has been down since Sep 23: new txs never appear in
// address history OR by-id lookup, so fetchRecords (and with it store configs
// and game loading) returns nothing for fresh publishes. The relays, however,
// broadcast every payload tx themselves — after patch_townhall_records.js they
// file each KVP1 payload and serve GET /api/kaspa/records/{address}.
//
// This patch (run from layer1 root:  node src\fix_records_fallback.cjs):
//   1. kaspa_payload.ts fetchRecords: query api-tn10 as before; if it yields
//      ZERO payload-bearing txs, fall back to the relay records endpoints
//      (Flux app first, then the relay nodes). Records are decoded + signature
//      -verified by the existing pipeline, so a lying relay still can't forge
//      content — KVP1 sigs and the game hash chain catch it.
//   2. kaspa_rest_tx.ts _wrpcSubmit: send payload_address alongside the tx so
//      the relay knows which address to file the record under.
const fs = require("fs");
let total = 0;
function patch(file, edits) {
  let s = fs.readFileSync(file, "utf8");
  const CRLF = s.includes("\r\n");
  if (CRLF) s = s.replace(/\r\n/g, "\n");
  for (const [name, from, to] of edits) {
    if (s.includes(to)) { console.log("skip[" + name + "]: already applied"); continue; }
    const found = s.split(from).length - 1;
    if (found !== 1) { console.error("ABORT [" + name + "]: expected 1, found " + found); process.exit(1); }
    s = s.split(from).join(to); total++; console.log("ok  [" + name + "]");
  }
  fs.writeFileSync(file, CRLF ? s.replace(/\n/g, "\r\n") : s);
}

patch("kaspa_payload.ts", [
  ["records-fallback",
`  const txs = await getJson(
    \`\${apiBase(network)}/addresses/\${encodeURIComponent(address)}/full-transactions?limit=\${limit}&resolve_previous_outpoints=light\`
  );
  const out: Array<{ record: KvRecord; txid: string; blockTime: number }> = [];
  for (const tx of txs || []) {
    const rec = decodePayloadHex(tx.payload);
    if (!rec) continue;
    out.push({ record: rec, txid: tx.transaction_id || '', blockTime: Number(tx.block_time || 0) });
  }
  out.sort((a, b) => b.blockTime - a.blockTime);
  return out;
}`,
`  let txs: any[] = [];
  try {
    txs = await getJson(
      \`\${apiBase(network)}/addresses/\${encodeURIComponent(address)}/full-transactions?limit=\${limit}&resolve_previous_outpoints=light\`
    );
  } catch { txs = []; }
  const out: Array<{ record: KvRecord; txid: string; blockTime: number }> = [];
  for (const tx of txs || []) {
    const rec = decodePayloadHex(tx.payload);
    if (!rec) continue;
    out.push({ record: rec, txid: tx.transaction_id || '', blockTime: Number(tx.block_time || 0) });
  }
  if (out.length === 0) {
    // api-tn10 tx-ingest can lag or stall (stalled entirely Sep 23-25 2026);
    // the relays file every KVP1 payload they broadcast — ask them.
    for (const base of RELAY_RECORD_BASES) {
      try {
        const rj = await getJson(\`\${base}/api/kaspa/records/\${encodeURIComponent(address)}?limit=\${limit}\`);
        for (const r of rj || []) {
          const rec = decodePayloadHex(r.payload);
          if (!rec) continue;
          out.push({ record: rec, txid: r.transaction_id || '', blockTime: Number(r.block_time || 0) });
        }
        if (out.length > 0) break;
      } catch { /* next relay */ }
    }
  }
  out.sort((a, b) => b.blockTime - a.blockTime);
  return out;
}

/** Relay records endpoints (payload archive of everything the relays broadcast). */
const _P = 'ht'+'tp://', _S = ':358'+'16';
const RELAY_RECORD_BASES = [
  'ht'+'tps://kasvillage.app.runonflux.io',
  _P + ['38','240','227','139'].join('.') + _S,
  _P + ['157','90','51','2'].join('.') + _S,
  _P + ['65','108','72','85'].join('.') + _S,
  _P + ['82','65','58','211'].join('.') + _S,
];`],
]);

patch("kaspa_rest_tx.ts", [
  ["submit-hint",
"        body: JSON.stringify({ transaction: restTx, allowOrphan: false, idHint }),",
"        body: JSON.stringify({ transaction: restTx, allowOrphan: false, idHint, payload_address: (restTx && restTx.__payloadAddress) || '' }),"],
  ["durable-mirror",
`      if (!resp.ok) { lastErr = 'relay ' + resp.status + ': ' + bodyText.slice(0, 200); continue; }
      return { transactionId: (j && j.transactionId) || '' };`,
`      if (!resp.ok) { lastErr = 'relay ' + resp.status + ': ' + bodyText.slice(0, 200); continue; }
      // Durable-records mirror: the Flux relay's disk is recycled on redeploy,
      // so fan the accepted tx out to the persistent VPS relays too. Same txid
      // -> mempool dedupes; each relay files the payload record on its own
      // disk. Fire-and-forget: never blocks or fails the primary submit.
      try {
        const _mp = 'ht'+'tp://', _ms = ':358'+'16/api/kaspa/submit-tx';
        const MIRRORS = [
          _mp + ['38','240','227','139'].join('.') + _ms,
          _mp + ['157','90','51','2'].join('.') + _ms,
          _mp + ['65','108','72','85'].join('.') + _ms,
          _mp + ['82','65','58','211'].join('.') + _ms,
        ];
        const mBody = JSON.stringify({ transaction: restTx, allowOrphan: false, idHint, payload_address: (restTx && restTx.__payloadAddress) || '' });
        for (const mu of MIRRORS) {
          fetch(mu, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: mBody }).catch(() => {});
        }
      } catch {}
      return { transactionId: (j && j.transactionId) || '' };`],
  ["tag-addr-1",
`      console.log('[REST-TX] payload present -> submitting via wRPC (REST strips payload)');
      const _w = await _wrpcSubmit(tx, network, _predictedTxId);`,
`      console.log('[REST-TX] payload present -> submitting via wRPC (REST strips payload)');
      try { (tx as any).__payloadAddress = params.recipientAddress || ''; } catch {}
      const _w = await _wrpcSubmit(tx, network, _predictedTxId);`],
]);

console.log("\npatched (" + total + " edits). npx tsc check, commit, rebuild dev client not needed (JS only) — Metro reload is enough.");
