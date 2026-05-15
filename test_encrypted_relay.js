const { secp256k1: secp } = require('@noble/curves/secp256k1');
const { blake2b } = require('@noble/hashes/blake2b');
const { sha256 } = require('@noble/hashes/sha256');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');

const KASPA_HASH_KEY = new TextEncoder().encode('TransactionSigningHash');
function kaspaBlake2b(data) { return blake2b(data, { dkLen: 32, key: KASPA_HASH_KEY }); }
let passed = 0, failed = 0;
function t(name, cond) { if(cond){passed++;console.log('  OK '+name)}else{failed++;console.log('  FAIL '+name)} }

console.log('ENCRYPTED RELAY: 11-FIELD BINDING TEST');

const privA = bytesToHex(secp.utils.randomPrivateKey());
const privB = bytesToHex(secp.utils.randomPrivateKey());
const pubA = bytesToHex(secp.getPublicKey(hexToBytes(privA), true));
const pubB = bytesToHex(secp.getPublicKey(hexToBytes(privB), true));
const partialSig = bytesToHex(secp.utils.randomPrivateKey());

const ctx = {
  agreementId: 'AGR_TEST_' + Date.now(),
  buyerPubkey: pubA,
  sellerPubkey: pubB,
  multisigAddress: 'kaspatest:qznsy3ps6k2t5rme49sspzkjqje3ylcfjevwrqw3eeaz29frmyq0g0qy20kxp',
  aggregatedPubkey: bytesToHex(secp.getPublicKey(secp.utils.randomPrivateKey(), true)),
  network: 'testnet-10',
  itemPriceKas: 5,
  sellerCommitmentKas: 5,
  lamportHash: bytesToHex(sha256(new TextEncoder().encode('lamport_attestation_123'))),
  R_hex: bytesToHex(secp.getPublicKey(secp.utils.randomPrivateKey(), true)),
};

function deriveShared(priv, pub) {
  const s = BigInt('0x' + priv);
  return kaspaBlake2b(secp.ProjectivePoint.fromHex(pub).multiply(s).toRawBytes(true));
}
function deriveEncKey(shared, c) {
  const d = new TextEncoder().encode([c.agreementId,c.buyerPubkey,c.sellerPubkey,c.multisigAddress,c.aggregatedPubkey,c.network,c.itemPriceKas.toString(),c.sellerCommitmentKas.toString(),c.lamportHash||'',c.R_hex].join('|'));
  return kaspaBlake2b(new Uint8Array([...shared,...d]));
}
function deriveNonce(ek, r) { return kaspaBlake2b(new Uint8Array([...ek,...hexToBytes(r.slice(0,64))])).slice(0,12); }
function xorC(data, ek, n) {
  const ks = kaspaBlake2b(new Uint8Array([...ek,...n,0]));
  const out = new Uint8Array(data.length);
  for(let i=0;i<data.length;i++) out[i]=data[i]^ks[i%ks.length];
  return out;
}

console.log('\n1. CORE');
const sharedA = deriveShared(privA, pubB);
const sharedB = deriveShared(privB, pubA);
t('ECDH symmetric', bytesToHex(sharedA) === bytesToHex(sharedB));
const ekA = deriveEncKey(sharedA, ctx);
const nonce = deriveNonce(ekA, ctx.R_hex);
const enc = xorC(hexToBytes(partialSig), ekA, nonce);
t('Encrypted != plaintext', bytesToHex(enc) !== partialSig);
const ekB = deriveEncKey(sharedB, ctx);
const dec = xorC(enc, ekB, nonce);
t('Decrypt recovers plaintext', bytesToHex(dec) === partialSig);

console.log('\n2. TOWNHALL OPERATOR');
const fakePriv = bytesToHex(secp.utils.randomPrivateKey());
const fakeShared = deriveShared(fakePriv, pubA);
const fakeEk = deriveEncKey(fakeShared, ctx);
const fakeDec = xorC(enc, fakeEk, nonce);
t('Operator gets garbage', bytesToHex(fakeDec) !== partialSig);

console.log('\n3. WRONG COUNTERPARTY');
const privC = bytesToHex(secp.utils.randomPrivateKey());
const sharedC = deriveShared(privC, pubA);
const ekC = deriveEncKey(sharedC, ctx);
const decC = xorC(enc, ekC, nonce);
t('Party C gets garbage', bytesToHex(decC) !== partialSig);

console.log('\n4. FIELD-BY-FIELD (10 fields)');
const fields = ['agreementId','buyerPubkey','sellerPubkey','multisigAddress','aggregatedPubkey','network','itemPriceKas','sellerCommitmentKas','lamportHash','R_hex'];
for (const field of fields) {
  const badCtx = { ...ctx };
  if (typeof badCtx[field] === 'number') badCtx[field] = 999;
  else if (field === 'lamportHash') badCtx[field] = bytesToHex(sha256(new TextEncoder().encode('WRONG')));
  else badCtx[field] = 'WRONG_' + field;
  const badEk = deriveEncKey(sharedB, badCtx);
  const badDec = xorC(enc, badEk, nonce);
  t('Wrong ' + field, bytesToHex(badDec) !== partialSig);
}

console.log('\n5. ONE-TIME USE');
const ctx2 = { ...ctx, agreementId: 'AGR_DIFFERENT_' + Date.now() };
const ek2 = deriveEncKey(sharedB, ctx2);
const dec2 = xorC(enc, ek2, nonce);
t('Different agreement = garbage', bytesToHex(dec2) !== partialSig);

console.log('\nRESULTS: ' + passed + '/' + (passed+failed) + ' passed');
if(failed===0) console.log('ALL TESTS PASSED');
