// fix_02_prefix.cjs
// Bug: release TX derives buyer/seller payout addresses by forcing '02' prefix on
// x-only pubkeys. For odd-y keys (03...) this produces the WRONG address, so the
// payout goes to an address the party does not control.
// Fix: preserve the real prefix. If the key is already full-compressed (66 hex chars),
// use it as-is. Only if it's x-only (64 chars) do we need a prefix — and we cannot
// know even/odd from x alone, so we must use the full key. These pubkeys come in
// full-compressed already (pubkeyA/pubkeyB), so just use them directly.
const fs = require('fs');
let s = fs.readFileSync('frost_complete.ts', 'utf8');

if (s.includes('// [02-FIX]')) { console.log('already applied'); process.exit(0); }

const oldBuyer  = "const buyerAddr = aggregateToAddress('02' + (buyerPk.length === 66 ? buyerPk.slice(2) : buyerPk), params.frostAddress.network);";
const oldSeller = "const sellerAddr = aggregateToAddress('02' + (sellerPk.length === 66 ? sellerPk.slice(2) : sellerPk), params.frostAddress.network);";

const newBuyer  = "const buyerAddr = aggregateToAddress(buyerPk.length === 66 ? buyerPk : ('02' + buyerPk), params.frostAddress.network); // [02-FIX] use real prefix from full key";
const newSeller = "const sellerAddr = aggregateToAddress(sellerPk.length === 66 ? sellerPk : ('02' + sellerPk), params.frostAddress.network); // [02-FIX] use real prefix from full key";

let ok = true;
if (s.indexOf(oldBuyer) < 0) { console.log('BUYER ANCHOR FAIL'); ok = false; } else { s = s.replace(oldBuyer, newBuyer); }
if (s.indexOf(oldSeller) < 0) { console.log('SELLER ANCHOR FAIL'); ok = false; } else { s = s.replace(oldSeller, newSeller); }

if (!ok) process.exit(1);
fs.writeFileSync('frost_complete.ts', s);
console.log('OK - payout addresses now use real key prefix');
