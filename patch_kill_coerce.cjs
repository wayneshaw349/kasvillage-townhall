// patch_kill_coerce.cjs — coerce contract.agreementId to string in 4b-kill wiring
// Run: node patch_kill_coerce.cjs
const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');

const A = "laUpsert({ agrId: contract.agreementId, killTxId: _kres.transactionId }).then(() => laStep(contract.agreementId, 'kill_broadcast')).catch(() => {});";
const B = "laUpsert({ agrId: contract.agreementId || '', killTxId: _kres.transactionId }).then(() => laStep(contract.agreementId || '', 'kill_broadcast')).catch(() => {});";

if (s.includes(B)) { console.log('already coerced'); process.exit(0); }
const c = s.split(A).length - 1;
if (c !== 1) { console.error('anchor count=' + c + ' — abort'); process.exit(1); }
fs.writeFileSync(F + '.bak_killcoerce', s);
s = s.replace(A, B);
fs.writeFileSync(F, s);
console.log('patched ok');
