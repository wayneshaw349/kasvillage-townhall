// make_mod_key.cjs — COLD MOD KEY generator (run on the PC, in the project folder).
//   node make_mod_key.cjs              -> generates a fresh mod key + 2-of-3 Shamir shards
//   node make_mod_key.cjs recover 1:<hex> 3:<hex>   -> rebuilds the private key from any 2 shards
// The private key is printed ONCE. Write it down / print it as a QR, put it in a safe,
// give the 3 shards to 3 separate places (any 2 rebuild the key). It is NEVER stored
// in the app or on this PC - this script writes only modkey.pub.txt (the PUBLIC key).
const crypto = require('crypto');
const fs = require('fs');

// ---- GF(256) Shamir 2-of-3 ----
const gmul = (a, b) => { let p = 0; for (let i = 0; i < 8; i++) { if (b & 1) p ^= a; const hi = a & 0x80; a = (a << 1) & 0xff; if (hi) a ^= 0x1b; b >>= 1; } return p; };
const gpow = (a, n) => { let r = 1; for (let i = 0; i < n; i++) r = gmul(r, a); return r; };
const ginv = (a) => { for (let i = 1; i < 256; i++) if (gmul(a, i) === 1) return i; throw new Error('no inverse'); };
function split(secret) {
  const shares = [[], [], []];
  for (const byte of secret) {
    const coef = crypto.randomBytes(1)[0];
    for (let x = 1; x <= 3; x++) shares[x - 1].push(byte ^ gmul(coef, x));
  }
  return shares.map((s, i) => (i + 1) + ':' + Buffer.from(s).toString('hex'));
}
function recover(sh1, sh2) {
  const [x1, h1] = sh1.split(':'); const [x2, h2] = sh2.split(':');
  const a = Buffer.from(h1, 'hex'), b = Buffer.from(h2, 'hex');
  const X1 = Number(x1), X2 = Number(x2);
  if (!X1 || !X2 || X1 === X2 || a.length !== b.length) throw new Error('bad shards');
  // Lagrange at 0: s = y1*x2/(x2^x1-ish in GF) ... L1 = x2/(x1^x2 xor-field): l1 = x2 * inv(x1 xor x2), l2 = x1 * inv(x1 xor x2)
  const d = ginv(X1 ^ X2);
  const l1 = gmul(X2, d), l2 = gmul(X1, d);
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) out[i] = gmul(a[i], l1) ^ gmul(b[i], l2);
  return out.toString('hex');
}

if (process.argv[2] === 'recover') {
  const priv = recover(process.argv[3], process.argv[4]);
  console.log('RECOVERED mod private key:\n  ' + priv);
  try {
    const { secp256k1 } = require('@noble/curves/secp256k1');
    console.log('Public key: ' + Buffer.from(secp256k1.getPublicKey(Buffer.from(priv, 'hex'), true)).toString('hex'));
  } catch {}
  process.exit(0);
}

const { secp256k1 } = require('@noble/curves/secp256k1');
let priv;
do { priv = crypto.randomBytes(32); } while (!secp256k1.utils.isValidPrivateKey(priv));
const pub = Buffer.from(secp256k1.getPublicKey(priv, true)).toString('hex');
const privHex = priv.toString('hex');
const shards = split(priv);
// self-check: every shard pair must rebuild the key
for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (recover(shards[i], shards[j]) !== privHex) { console.error('SELF-CHECK FAILED - run again'); process.exit(1); }
fs.writeFileSync('modkey.pub.txt', pub);
console.log('================ COLD MOD KEY (shown ONCE - not saved) ================');
console.log('PRIVATE key (QR/safe):\n  ' + privHex);
console.log('\nPUBLIC key (goes in the app, saved to modkey.pub.txt):\n  ' + pub);
console.log('\nShamir shards - 2 of 3 rebuild the private key. Store separately:');
shards.forEach(s => console.log('  shard ' + s.split(':')[0] + ':  ' + s));
console.log('\nRecover later:  node make_mod_key.cjs recover <shardA> <shardB>');
console.log('Self-check: all 3 shard pairs rebuilt the key OK.');
console.log('=======================================================================');
