const fs = require('fs');
const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');
if (s.includes('402-TOLERANT')) throw new Error('already patched - abort');

const o1 = "if (/cooldown|queued|rate/i.test(_arErr)) {";
if (s.split(o1).length - 1 !== 1) throw new Error('anchor 1 not unique - abort');

const o2 = "console.warn('[Refund] Arweave inscription threw:', _arE);";
if (s.split(o2).length - 1 !== 1) throw new Error('anchor 2 not unique - abort');

const o3lf = "Alert.alert('Backup Failed', 'Could not publish the signed refund to Arweave. Nothing was sent.');";
if (s.split(o3lf).length - 1 !== 1) throw new Error('anchor 3 not unique - abort');
// find the closing of the catch block right after: setIsLoading(false); return; }
const idx = s.indexOf(o3lf);
const tail = s.slice(idx, idx + 400);
const m = tail.match(/Alert\.alert\('Backup Failed', 'Could not publish the signed refund to Arweave\. Nothing was sent\.'\);\s*\r?\n\s*setIsLoading\(false\); return;\s*\r?\n\s*\}/);
if (!m) throw new Error('catch-block shape not found - abort');
const CATCH_OLD = m[0];

fs.writeFileSync(F + '.bak402', s);

s = s.replace(o1, "if (/cooldown|queued|rate|402|x402/i.test(_arErr)) { /* 402-TOLERANT */");
s = s.replace(o2, o2 + " if (/cooldown|queued|rate|402|x402/i.test(String(_arE))) { console.warn('[Refund] threw rate-limit - proceeding; SlothQueue lands it.'); } else {");
s = s.replace(CATCH_OLD, CATCH_OLD + " }");

fs.writeFileSync(F, s);
const v = fs.readFileSync(F, 'utf8');
if (!v.includes('402-TOLERANT')) throw new Error('POST: marker missing');
if ((v.match(/402\|x402/g) || []).length !== 2) throw new Error('POST: expected 2 tolerant tests');
console.log('OK - 402/x402 tolerated in both backup branches (.bak402)');
