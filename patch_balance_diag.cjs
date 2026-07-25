// patch_balance_diag.cjs — log the prop the header actually renders with
// Run: node patch_balance_diag.cjs
const fs = require('fs');
const P = 'Dashboard.tsx';

let src = fs.readFileSync(P, 'utf8');
const before = src;
const OLD = 'const kasBalance = Number(balanceSompi) / 100_000_000;';
const n = src.split(OLD).length - 1;
if (n !== 1) throw new Error(`expected 1 anchor, found ${n}`);

src = src.split(OLD).join(
  "console.log('[WalletUI] render balanceSompi:', balanceSompi.toString());\n  " + OLD
);

if (!src.includes('[WalletUI] render balanceSompi')) throw new Error('post-condition failed');
fs.writeFileSync(P + '.bak-diag', before, 'utf8');
fs.writeFileSync(P, src, 'utf8');
console.log('[done] backup at ' + P + '.bak-diag');
