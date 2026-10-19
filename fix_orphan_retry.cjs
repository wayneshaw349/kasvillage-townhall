// fix_orphan_retry.cjs - big publishes (KasCity = ~400 chained txs) failing with
// "transaction ... is an orphan where orphan is disallowed".
// Cause: kasvillage.app.runonflux.io load-balances across several Flux nodes. Chunk N spends chunk N-1's
// change; if chunk N lands on a node whose Kaspa node hasn't seen chunk N-1 yet (a second or two of
// propagation), it's rejected as an orphan. Fix: on an orphan rejection, resend the SAME signed tx
// (same txid - nothing is double-spent) after 1.5s, 3s, 5s, 8s, 12s. Any other rejection is still final.
const fs = require('fs');
const f = 'kaspa_rest_tx.ts';
let s = fs.readFileSync(f, 'utf8'); const CRLF = s.includes('\r\n'); if (CRLF) s = s.replace(/\r\n/g, '\n');
if (s.includes('KV_ORPHAN_RETRY')) { console.log(f + ': already patched - skipping'); process.exit(0); }
const A = 'async function _wrpcSubmit(restTx: any, network: KaspaNetwork, idHint: string): Promise<{ transactionId?: string; error?: string }> {\n';
const B = 'async function _wrpcSubmit(restTx: any, network: KaspaNetwork, idHint: string): Promise<{ transactionId?: string; error?: string }> {\n' +
'  // KV_ORPHAN_RETRY: a chained tx can reach a node that has not seen its parent yet - resend the same tx\n' +
'  const _waits = [1500, 3000, 5000, 8000, 12000];\n' +
'  let _r = await _wrpcSubmitOnce(restTx, network, idHint);\n' +
'  for (let _i = 0; _i < _waits.length && _r.error && /orphan/i.test(_r.error); _i++) {\n' +
'    console.warn(\'[REST-TX] parent not on this node yet (orphan) - resending same tx in \' + _waits[_i] + \'ms\');\n' +
'    await new Promise((res) => setTimeout(res, _waits[_i]));\n' +
'    _r = await _wrpcSubmitOnce(restTx, network, idHint);\n' +
'    if (_r.error && /already (in the mempool|accepted)|duplicate/i.test(_r.error)) return { transactionId: idHint || \'\' };\n' +
'  }\n' +
'  return _r;\n' +
'}\n' +
'async function _wrpcSubmitOnce(restTx: any, network: KaspaNetwork, idHint: string): Promise<{ transactionId?: string; error?: string }> {\n';
const c = s.split(A).length - 1;
if (c !== 1) { console.error(f + ' anchor count = ' + c + ' - expected 1. Aborting - nothing written.'); process.exit(1); }
s = s.replace(A, B);
fs.writeFileSync(f, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log(f + ': patched - orphan rejections are retried with the same signed tx.');
