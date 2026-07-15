// patch_nonce_strip.cjs — remove the dead generateFrostNonce() call from the accept path.
//
// WHY: generateFrostNonce derives k = blake2b(d_tweaked || message) where
//      message = {frost, aggPubkey, to, amount} — it does NOT include the sighash.
//      Two different transactions spending the same escrow, to the same recipient,
//      for the same amount therefore get the SAME k. Sign both and:
//          s1 = k + e1*d ;  s2 = k + e2*d  ->  d = (s1-s2)/(e1-e2)
//      i.e. the wallet key falls out by division. The refund and the (planned) kill
//      tx share frost/aggPubkey/to/amount and differ only in outputs — exactly that setup.
//
// Nothing signs with this nonce today: the seller's step-5 path is sellerSignTemplate,
// which generates its own random nonce internally and never reads storage. The only
// readers want R_hex, and all of them already tolerate ''. So this call writes a nonce
// nobody uses, posts a meaningless R to TownHall, and inscribes its hash to Arweave.
// It is dead weight sitting in the fund-moving path. Remove it before the kill tx lands.
//
// Run: node patch_nonce_strip.cjs
const fs = require('fs');

const F = 'NeighborAgreement.tsx';
let s = fs.readFileSync(F, 'utf8');

function occurrences(hay, needle){ let n = 0, i = 0; for(;;){ const j = hay.indexOf(needle, i); if (j < 0) break; n++; i = j + needle.length; } return n; }
function requireCount(name, needle, expect){
  const n = occurrences(s, needle);
  if (n !== expect) { console.error('ABORT ['+name+'] found '+n+', expected '+expect); process.exit(1); }
  console.log('OK ['+name+'] count='+n);
}

// ---- 1: the payload closure (one long line) ----
const CALL = "                payload: await (async () => { try { const nonce = generateFrostNonce({";
requireCount('payload closure', CALL, 1);
const i1 = s.indexOf(CALL);
let i2 = s.indexOf('\n', i1);
if (i2 < 0) { console.error('ABORT: no line end after payload closure'); process.exit(1); }
const line = s.slice(i1, i2);
// The closure returns '' on every path — confirm before assuming the payload is empty.
if (line.indexOf("return '';") < 0) { console.error('ABORT: closure does not unconditionally return empty payload'); process.exit(1); }
if (line.indexOf('})(),') < 0) { console.error('ABORT: closure does not end as expected on one line'); process.exit(1); }
console.log('Removing ' + line.length + ' bytes of dead nonce generation');
s = s.slice(0, i1) +
    "                // [NONCE-STRIP] generateFrostNonce removed: its k ignores the sighash\r\n" +
    "                // (k = blake2b(d || {frost,aggPubkey,to,amount})), so two spends of the\r\n" +
    "                // same escrow with different outputs would share k and leak the key.\r\n" +
    "                // Nothing signed with it — the closure always returned '' anyway.\r\n" +
    "                payload: ''," +
    s.slice(i2);

// ---- 2: drop the import so it cannot be reintroduced by accident ----
const IMP = "  generateFrostNonce,\n";
requireCount('import', IMP, 1);
s = s.replace(new RegExp("  generateFrostNonce,\\r?\\n"), "");

// ---- post-conditions ----
if (s.indexOf('generateFrostNonce') >= 0) { console.error('ABORT: generateFrostNonce still referenced'); process.exit(1); }
if (s.indexOf("payload: '',") < 0) { console.error('ABORT: replacement payload missing'); process.exit(1); }
if (s.indexOf('prepareOnly: true,') < 0) { console.error('ABORT: 2b prepareOnly lost'); process.exit(1); }
if (s.indexOf('[Refund] Funding tx FROZEN') < 0) { console.error('ABORT: 2b refund block lost'); process.exit(1); }

fs.writeFileSync(F, s);
console.log('WROTE ' + F);
console.log('NOTE: frostR readers (Accepted inscription, TownHall postFrostR, delivery-confirm copy) now see "" — all already handled that.');
