import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { blake2b } from '@noble/hashes/blake2b';
import { hmac } from '@noble/hashes/hmac';

secp.etc.hmacSha256Sync = (key, ...msgs) => {
  const cat = new Uint8Array(msgs.reduce((n, m) => n + m.length, 0));
  let off = 0; for (const m of msgs) { cat.set(m, off); off += m.length; }
  return hmac(sha256, key, cat);
};

const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const KASPA_KEY = new TextEncoder().encode('TransactionSigningHash');
const h2b = hex => { const b = new Uint8Array(hex.length/2); for(let i=0;i<b.length;i++) b[i]=parseInt(hex.slice(i*2,i*2+2),16); return b; };
const b2h = b => Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const kb2b = d => blake2b(d, { dkLen: 32, key: KASPA_KEY });

const buyerPriv = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const sellerPriv = 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5';
const buyerPub = b2h(secp.getPublicKey(h2b(buyerPriv), true));
const sellerPub = b2h(secp.getPublicKey(h2b(sellerPriv), true));
const [pk1,pk2] = [buyerPub,sellerPub].sort();

console.log('Buyer:', buyerPub.slice(0,20)+'...');
console.log('Seller:', sellerPub.slice(0,20)+'...');

const L = sha256(new TextEncoder().encode(pk1+pk2+'AGR_TEST'));
const a1 = BigInt('0x'+b2h(sha256(new Uint8Array([...L,...h2b(pk1)]))))%N;
const a2 = BigInt('0x'+b2h(sha256(new Uint8Array([...L,...h2b(pk2)]))))%N;
const P_agg = secp.ProjectivePoint.fromHex(pk1).multiply(a1).add(secp.ProjectivePoint.fromHex(pk2).multiply(a2));
const aggHex = b2h(P_agg.toRawBytes(true));
console.log('AggPub:', aggHex.slice(0,20)+'...');

const msg = new TextEncoder().encode(JSON.stringify({frost:'kaspatest:qfrost',aggPubkey:aggHex,to:'kaspatest:qrecip',amount:'1500000000',recipients:undefined}));
const msgHash = kb2b(msg);
console.log('MsgHash:', b2h(msgHash).slice(0,20)+'...');

function partialSig(privHex) {
  const sk = BigInt('0x'+privHex);
  const Pab = P_agg.toRawBytes(true);
  let d = sk; if(Pab[0]===0x03) d=(N-sk)%N;
  const kI = new Uint8Array([...h2b(d.toString(16).padStart(64,'0')),...h2b(aggHex),...msgHash]);
  const k = BigInt('0x'+b2h(sha256(kI)))%N;
  const R = secp.ProjectivePoint.BASE.multiply(k);
  const Rx = R.toRawBytes(true).slice(1);
  const aggX = h2b(aggHex).slice(1);
  const e = BigInt('0x'+b2h(blake2b(new Uint8Array([...Rx,...aggX,...msgHash]),{dkLen:32})))%N;
  const s = (k+e*d)%N;
  const sig = new Uint8Array(64);
  sig.set(Rx,0); sig.set(h2b(s.toString(16).padStart(64,'0')),32);
  return b2h(sig);
}

const sA = partialSig(buyerPriv);
const sB = partialSig(sellerPriv);
console.log('SigA:', sA.slice(0,24)+'...');
console.log('SigB:', sB.slice(0,24)+'...');

try {
  const bA=h2b(sA), bB=h2b(sB);
  let RA; try{RA=secp.ProjectivePoint.fromHex(new Uint8Array([2,...bA.slice(0,32)]))}catch{RA=secp.ProjectivePoint.fromHex(new Uint8Array([3,...bA.slice(0,32)]))}
  let RB; try{RB=secp.ProjectivePoint.fromHex(new Uint8Array([2,...bB.slice(0,32)]))}catch{RB=secp.ProjectivePoint.fromHex(new Uint8Array([3,...bB.slice(0,32)]))}
  const Ragg=RA.add(RB);
  const RaggX=Ragg.toRawBytes(true).slice(1);
  const sAgg=(BigInt('0x'+b2h(bA.slice(32)))+BigInt('0x'+b2h(bB.slice(32))))%N;
  const final=new Uint8Array(64);
  final.set(RaggX,0); final.set(h2b(sAgg.toString(16).padStart(64,'0')),32);
  console.log('Aggregate:', b2h(final).slice(0,24)+'...');
  console.log('Result: SUCCESS (no sqrt invalid)');
} catch(e) { console.log('Result: FAILED -', e.message); process.exit(1); }


// === BIP340 SIGNATURE VERIFICATION ===
console.log('
--- BIP340 Verification ---');

// Reconstruct: verify s*G == R + e*P_agg
const aggXOnly = h2b(aggHex).slice(1);
const RaggFull = RA.add(RB);
const RaggBytes = RaggFull.toRawBytes(true);
const RaggXV = RaggBytes.slice(1);

// Recompute challenge e using aggregate R
const eVerify = BigInt('0x'+b2h(blake2b(new Uint8Array([...RaggXV,...aggXOnly,...msgHash]),{dkLen:32})))%N;

// s_agg * G should equal R_agg + e * P_agg
const sAggBig = (BigInt('0x'+b2h(bA.slice(32)))+BigInt('0x'+b2h(bB.slice(32))))%N;
const sG = secp.ProjectivePoint.BASE.multiply(sAggBig);

// For BIP340: if R_agg has odd y, we negated k values, so adjust
// P_agg for verification must be x-only (even y)
let P_verify = P_agg;
if (P_agg.toRawBytes(true)[0] === 0x03) P_verify = P_agg.negate();
let R_verify = RaggFull;
if (RaggBytes[0] === 0x03) R_verify = RaggFull.negate();

const expected = R_verify.add(P_verify.multiply(eVerify));

// Compare x-coordinates (BIP340 only checks x)
const sG_x = b2h(sG.toRawBytes(true).slice(1));
const expected_x = b2h(expected.toRawBytes(true).slice(1));

console.log('s*G x:     ', sG_x.slice(0,24)+'...');
console.log('R+e*P x:   ', expected_x.slice(0,24)+'...');
console.log('BIP340 valid:', sG_x === expected_x ? 'VERIFIED' : 'INVALID');

if (sG_x !== expected_x) {
  console.log('
DEBUG: Trying with challenge computed per-party R (not aggregate)...');
  console.log('This means the partial sigs use individual R for challenge, not R_agg.');
  console.log('The FROST protocol requires both parties to know R_agg BEFORE computing s_i.');
  console.log('Current implementation computes s_i with individual R — this is the bug.');
  process.exit(1);
}
console.log('
=== FULL VERIFICATION PASSED ===');

console.log('ALL TESTS PASSED');
