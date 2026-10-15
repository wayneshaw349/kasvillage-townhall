// fix_anchor_fields.cjs — the evidence-chain row read anchor fields that don't
// exist (daaScore/header). ChainAnchor's real fields are releaseDaaScore and
// utxoCommitment (the MuHash). The anchor was stamped all along; only the
// display was blind.
const fs = require('fs');
const F = 'PhoneProofScreen.tsx';
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.includes('\r\n');
if (CRLF) s = s.replace(/\r\n/g, '\n');

const A = "{_a ? 'DAA ' + String(_a.daaScore || _a.daa || '?') + '  tx ' + String(_a.txId || _a.releaseTxId || _a.txid || '').slice(0, 16) + (_a.header ? '  MuHash \\u2713' : '  header pending') : 'anchor pending'}";
const B = "{_a ? 'DAA ' + String(_a.releaseDaaScore || '?') + '  tx ' + String(_a.releaseTxId || '').slice(0, 16) + (_a.utxoCommitment ? '  MuHash \\u2713' : '  header pending') : 'anchor pending'}";

const c = s.split(A).length - 1;
if (c !== 1) { console.error('ANCHOR count =', c, '- expected 1. Aborting.'); process.exit(1); }
s = s.split(A).join(B);
fs.writeFileSync(F, CRLF ? s.replace(/\n/g, '\r\n') : s);
console.log('patched: evidence row reads releaseDaaScore + utxoCommitment (MuHash)');
