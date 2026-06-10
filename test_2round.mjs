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

console.log('=== 2-ROUND FROST (exact frost_complete.ts math) ===\n');

const buyerPriv = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const sellerPriv = 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5';
const buyerPub = b2h(secp.getPublicKey(h2b(buyerPriv), true));
const sellerPub = b2h(secp.getPublicKey(h2b(sellerPriv), true));
const [pk1,pk2] = [buyerPub,sellerPub].sort();

// MuSig aggregate
const L = sha256(new TextEncoder().encode(pk1+pk2+'AGR_TEST'));
const a1s = BigInt('0x'+b2h(sha256(new Uint8Array([...L,...h2b(pk1)]))))%N;
const a2s = BigInt('0x'+b2h(sha256(new Uint8Array([...L,...h2b(pk2)]))))%N;
const P1 = secp.ProjectivePoint.fromHex(pk1);
const P2 = secp.ProjectivePoint.fromHex(pk2);
const P_agg = P1.multiply(a1s).add(P2.multiply(a2s));
const aggHex = b2h(P_agg.toRawBytes(true));
console.log('P_agg:', aggHex.slice(0,20), 'prefix:', aggHex.slice(0,2));

// Message (matches generateFrostNonce exactly)
const frostAddr = 'kaspatest:qfrost';
const recipient = 'kaspatest:qrecip';
const amount = '1500000000';
const msgData = new TextEncoder().encode(JSON.stringify({frost:frostAddr,aggPubkey:aggHex,to:recipient,amount:amount}));
const message = kb2b(msgData);

// === generateFrostNonce (exact copy) ===
function genNonce(privHex) {
  const sk_raw = BigInt('0x'+privHex);
  const P_agg_bytes = P_agg.toRawBytes(true);
  let d = sk_raw;
  if (P_agg_bytes[0] === 0x03) d = (N - sk_raw) % N;
  const k_bytes = kb2b(new Uint8Array([...h2b(d.toString(16).padStart(64,'0')),...message]));
  let k = BigInt('0x'+b2h(k_bytes)) % N;
  if (k === 0n) k = 1n;
  const R = secp.ProjectivePoint.BASE.multiply(k);
  return {
    R_hex: b2h(R.toRawBytes(true)),
    k_private: k.toString(16).padStart(64,'0'),
    d_tweaked: d.toString(16).padStart(64,'0'),
    message_hex: b2h(message),
  };
}

const nonceA = genNonce(buyerPriv);
const nonceB = genNonce(sellerPriv);
console.log('R_A:', nonceA.R_hex.slice(0,20));
console.log('R_B:', nonceB.R_hex.slice(0,20));

// === computeFrostPartialS (exact copy) ===
function partialS(myNonce, counterpartyR_hex) {
  const R_mine = secp.ProjectivePoint.fromHex(myNonce.R_hex);
  const R_theirs = secp.ProjectivePoint.fromHex(counterpartyR_hex);
  let R_agg = R_mine.add(R_theirs);
  let k = BigInt('0x' + myNonce.k_private);
  const R_agg_bytes = R_agg.toRawBytes(true);
  if (R_agg_bytes[0] === 0x03) {
    k = (N - k) % N;
    R_agg = R_agg.negate();
  }
  const R_agg_x = R_agg.toRawBytes(true).slice(1);
  // P_agg x-only with parity normalization
  const P_agg_full = P_agg.toRawBytes(true);
  const P_x = P_agg_full[0] === 0x03 ? P_agg.negate().toRawBytes(true).slice(1) : P_agg_full.slice(1);
  const challengeInput = new Uint8Array([...R_agg_x, ...P_x, ...message]);
  const eHash = kb2b(challengeInput);
  const e = BigInt('0x' + b2h(eHash)) % N;
  const d = BigInt('0x' + myNonce.d_tweaked);
  const s = (k + e * d) % N;
  return { s_hex: s.toString(16).padStart(64,'0'), R_agg_x_hex: b2h(R_agg_x), e, k, d };
}

const pA = partialS(nonceA, nonceB.R_hex);
const pB = partialS(nonceB, nonceA.R_hex);

console.log('\nR_agg_x match:', pA.R_agg_x_hex === pB.R_agg_x_hex ? '✅' : '❌');
console.log('e match:', pA.e === pB.e ? '✅' : '❌');

// === aggregateFrostSig ===
const sAgg = (BigInt('0x'+pA.s_hex) + BigInt('0x'+pB.s_hex)) % N;

// === BIP340 verify: s*G == R + e*P ===
console.log('\n--- BIP340 Verify ---');
const sG = secp.ProjectivePoint.BASE.multiply(sAgg);

// R_agg (already even y from partialS)
const R_v = secp.ProjectivePoint.fromHex(new Uint8Array([0x02, ...h2b(pA.R_agg_x_hex)]));

// P_agg x-only (same normalization as partialS)
const P_agg_full = P_agg.toRawBytes(true);
const P_v = P_agg_full[0] === 0x03 ? P_agg.negate() : P_agg;

const expected = R_v.add(P_v.multiply(pA.e));

const sGx = b2h(sG.toRawBytes(true).slice(1));
const expx = b2h(expected.toRawBytes(true).slice(1));
const sGprefix = sG.toRawBytes(true)[0];
const expPrefix = expected.toRawBytes(true)[0];

console.log('s*G:     ', sGx.slice(0,24), 'prefix:', sGprefix);
console.log('R+eP:    ', expx.slice(0,24), 'prefix:', expPrefix);
console.log('x match:', sGx === expx ? '✅' : '❌');
console.log('prefix match:', sGprefix === expPrefix ? '✅' : '❌');
console.log('BIP340:', sGx === expx && sGprefix === expPrefix ? '✅ VERIFIED' : '❌ INVALID');

if (sGx !== expx) {
  // Debug: check if d_tweaked adjustment is the issue
  // In MuSig, each party's key is tweaked by a_i
  // d_tweaked should be a_i * sk, not just sk adjusted for P_agg parity
  console.log('\nDEBUG: d_tweaked may need MuSig tweak factor a_i');
  console.log('Current d_tweaked is just parity-adjusted sk');
  console.log('Correct d_tweaked should be: a_i * sk (mod N), then parity-adjusted');
  
  // Try with MuSig tweak
  function genNonceTweaked(privHex, myPub) {
    const sk_raw = BigInt('0x'+privHex);
    const myA = myPub === pk1 ? a1s : a2s;
    const sk_tweaked = (sk_raw * myA) % N;
    const P_agg_bytes = P_agg.toRawBytes(true);
    let d = sk_tweaked;
    if (P_agg_bytes[0] === 0x03) d = (N - sk_tweaked) % N;
    const k_bytes = kb2b(new Uint8Array([...h2b(d.toString(16).padStart(64,'0')),...message]));
    let k = BigInt('0x'+b2h(k_bytes)) % N;
    if (k === 0n) k = 1n;
    const R = secp.ProjectivePoint.BASE.multiply(k);
    return { R_hex: b2h(R.toRawBytes(true)), k_private: k.toString(16).padStart(64,'0'), d_tweaked: d.toString(16).padStart(64,'0'), message_hex: b2h(message) };
  }
  
  console.log('\n=== RETRY WITH MuSig TWEAK ===');
  const nA2 = genNonceTweaked(buyerPriv, buyerPub);
  const nB2 = genNonceTweaked(sellerPriv, sellerPub);
  const pA2 = partialS(nA2, nB2.R_hex);
  const pB2 = partialS(nB2, nA2.R_hex);
  console.log('R_agg match:', pA2.R_agg_x_hex === pB2.R_agg_x_hex ? '✅' : '❌');
  console.log('e match:', pA2.e === pB2.e ? '✅' : '❌');
  const sAgg2 = (BigInt('0x'+pA2.s_hex) + BigInt('0x'+pB2.s_hex)) % N;
  const sG2 = secp.ProjectivePoint.BASE.multiply(sAgg2);
  const R_v2 = secp.ProjectivePoint.fromHex(new Uint8Array([0x02, ...h2b(pA2.R_agg_x_hex)]));
  const P_v2 = P_agg_full[0] === 0x03 ? P_agg.negate() : P_agg;
  const exp2 = R_v2.add(P_v2.multiply(pA2.e));
  const sGx2 = b2h(sG2.toRawBytes(true).slice(1));
  const expx2 = b2h(exp2.toRawBytes(true).slice(1));
  console.log('s*G:  ', sGx2.slice(0,24));
  console.log('R+eP: ', expx2.slice(0,24));
  console.log('BIP340 with MuSig tweak:', sGx2 === expx2 ? '✅ VERIFIED' : '❌ STILL INVALID');
}

console.log('\n=== TEST COMPLETE ===');
