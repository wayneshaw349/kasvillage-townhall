const { secp256k1, schnorr } = require('@noble/curves/secp256k1');
const { sha256 } = require('@noble/hashes/sha256');
const { blake2b } = require('@noble/hashes/blake2b');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');

const N = secp256k1.CURVE.n;
const G = secp256k1.ProjectivePoint.BASE;

// Same test keys as test_frost_e2e.cjs
const BUYER = { priv: '041149b90ad3189ce363bf1b3854a4c2a2067e503b1f5d53c69d17732cb20c33' };
const SELLER = { priv: '3e4bf0e0bfc642b3f0645ceaf60e1e79bac5e56d2b5597220999393b53fc6efe' };

const buyerPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(BUYER.priv), true));
const sellerPub = bytesToHex(secp256k1.getPublicKey(hexToBytes(SELLER.priv), true));
console.log('Buyer pub:', buyerPub.slice(0,20));
console.log('Seller pub:', sellerPub.slice(0,20));

// ========================================
// REPLICATE frost_complete.ts LINE BY LINE
// ========================================

// Line 48: sort pubkeys
const [pk1, pk2] = [buyerPub, sellerPub].sort();
console.log('pk1 (sorted first):', pk1.slice(0,20));
console.log('pk2 (sorted second):', pk2.slice(0,20));

// Line 49: L hash ? THIS IS THE CRITICAL LINE
// Phone code: sha256(_pk1 + _pk2 + (sessionId || ''))
// Headless test: sha256(hexToBytes(pkA + pkB))
// ARE THESE THE SAME?

// Phone version (string concatenation, TextEncoder):
const phoneL = sha256(new TextEncoder().encode(pk1 + pk2 + ''));
console.log('Phone L (TextEncoder, string concat):', bytesToHex(phoneL).slice(0,20));

// Headless version (hex bytes concatenation):
const headlessL = sha256(hexToBytes(pk1 + pk2));
console.log('Headless L (hexToBytes):', bytesToHex(headlessL).slice(0,20));

console.log('L MATCH:', bytesToHex(phoneL) === bytesToHex(headlessL) ? 'YES' : '*** NO ? THIS IS THE BUG ***');

// Line 50: binding coefficient
// Phone: sha256([..._L, ...hexToBytes(myPubkey === _pk1 ? _pk1 : _pk2)])
// But wait ? this hashes L || pk_bytes
const phoneA1 = BigInt('0x' + bytesToHex(sha256(new Uint8Array([...phoneL, ...hexToBytes(pk1)])))) % N;
const headlessA1 = BigInt('0x' + bytesToHex(sha256(new Uint8Array([...headlessL, ...hexToBytes(pk1)])))) % N;
console.log('Phone a1:', phoneA1.toString(16).slice(0,16));
console.log('Headless a1:', headlessA1.toString(16).slice(0,16));
console.log('a1 MATCH:', phoneA1 === headlessA1 ? 'YES' : '*** NO ***');

// d_tweaked for buyer
const buyerSk = BigInt('0x' + BUYER.priv);
const phoneDtweakedBuyer = (buyerSk * phoneA1) % N;
const headlessDtweakedBuyer = (buyerSk * headlessA1) % N;
console.log('Phone d_tweaked buyer:', phoneDtweakedBuyer.toString(16).slice(0,16));
console.log('Headless d_tweaked buyer:', headlessDtweakedBuyer.toString(16).slice(0,16));
console.log('d_tweaked MATCH:', phoneDtweakedBuyer === headlessDtweakedBuyer ? 'YES' : '*** NO ***');

// Aggregate pubkey
const P1 = secp256k1.ProjectivePoint.fromHex(pk1);
const P2 = secp256k1.ProjectivePoint.fromHex(pk2);
const phoneA2 = BigInt('0x' + bytesToHex(sha256(new Uint8Array([...phoneL, ...hexToBytes(pk2)])))) % N;
const phonePagg = P1.multiply(phoneA1).add(P2.multiply(phoneA2));
const phonePaggHex = bytesToHex(phonePagg.toRawBytes(true));
console.log('Phone P_agg:', phonePaggHex.slice(0,20));
console.log('Phone P_agg parity:', phonePaggHex.startsWith('02') ? 'EVEN' : 'ODD');

const headlessA2 = BigInt('0x' + bytesToHex(sha256(new Uint8Array([...headlessL, ...hexToBytes(pk2)])))) % N;
const headlessPagg = P1.multiply(headlessA1).add(P2.multiply(headlessA2));
const headlessPaggHex = bytesToHex(headlessPagg.toRawBytes(true));
console.log('Headless P_agg:', headlessPaggHex.slice(0,20));

console.log('P_agg MATCH:', phonePaggHex === headlessPaggHex ? 'YES' : '*** NO ***');

// Now test challenge hash
const testSighash = hexToBytes('6e1e3754cd46814039d0000000000000000000000000000000000000000000000000');
const testRx = hexToBytes('13c5c09a1dbb5921a30400000000000000000000000000000000000000000000');
const phonePx = phonePagg.toRawBytes(true).slice(1);

// Phone code (after our fix): BIP340 tagged SHA256
const challengeTag = sha256(new TextEncoder().encode('BIP0340/challenge'));
const phoneE = BigInt('0x' + bytesToHex(sha256(new Uint8Array([...challengeTag, ...challengeTag, ...testRx, ...phonePx, ...testSighash])))) % N;
console.log('Phone e:', phoneE.toString(16).slice(0,16));

// What schnorr.sign would compute internally ? verify with schnorr.verify
console.log('\n=== CRITICAL COMPARISON ===');
console.log('If L hashes differ, ALL FROST math is wrong on phones');
console.log('Phone uses TextEncoder (UTF-8 string), headless uses hexToBytes');
console.log('sha256("0335f1be...") vs sha256(bytes[03,35,f1,be,...])');
console.log('These are COMPLETELY DIFFERENT inputs!');
