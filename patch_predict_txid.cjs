const fs = require('fs');
const f = 'kaspa_rest_tx.ts';
let c = fs.readFileSync(f, 'utf8');

if (c.includes('PREDICT_TXID_CHECKPOINT')) { console.error('ABORT: already patched'); process.exit(1); }
if (!c.includes('export function computeTxId')) { console.error('ABORT: computeTxId not found — run patch_computetxid first'); process.exit(1); }

// Anchor: right after the tx object is built, before the SUBMITTING log.
const anchor = `    console.log('[REST-TX] === SUBMITTING TX ===');`;
if (c.split(anchor).length - 1 !== 1) { console.error('ABORT: submit-log anchor count != 1'); process.exit(1); }

// Build the prediction using the SAME inputsData/outputsData that produced `tx`.
// inputsData: {txId:Uint8Array, index, sequence:bigint, ...}
// outputsData: {value:bigint, scriptVersion, script:Uint8Array}
const checkpoint = `    // PREDICT_TXID_CHECKPOINT — predict this tx's id before broadcast (for refund escrow-UTXO prediction)
    let _predictedTxId = '';
    try {
      _predictedTxId = computeTxId({
        version: 0,
        inputs: inputsData.map(inp => ({ prevTxId: bytesToHex(inp.txId), prevIndex: inp.index, sequence: inp.sequence })),
        outputs: outputsData.map(o => ({ amount: o.value, scriptVersion: o.scriptVersion, scriptHex: bytesToHex(o.script) })),
        lockTime: 0n,
        subnetworkId: SUBNETWORK_ID_NATIVE,
        gas: 0n,
        payloadHex: payload || '',
      });
      console.log('[REST-TX] PREDICTED txid:', _predictedTxId, '| escrow outpoint =', _predictedTxId + ':0');
    } catch (e) { console.warn('[REST-TX] txid prediction failed (non-fatal):', e); }
` + anchor;

c = c.replace(anchor, checkpoint);

// After submit, compare predicted vs node-returned for validation.
const submitAnchor = `    console.log('[REST-TX] Submit response:', JSON.stringify(result));`;
if (c.split(submitAnchor).length - 1 === 1) {
  c = c.replace(submitAnchor, submitAnchor + `
    if (_predictedTxId) {
      const _nodeTxId = result.transactionId || '';
      console.log('[REST-TX] PREDICT CHECK:', _predictedTxId === _nodeTxId ? 'MATCH ✓' : ('MISMATCH ✗ node=' + _nodeTxId));
    }`);
}

fs.writeFileSync(f, c);
console.log('OK — txid prediction checkpoint added (logs predicted + validates vs node)');
