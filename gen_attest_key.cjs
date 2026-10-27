// gen_attest_key.cjs - make a NEW TownHall attest key on YOUR machine. Nothing is written to disk or sent anywhere.
//   node gen_attest_key.cjs
// Put the SECRET only into Flux as an encrypted secret (never in the public app spec, never in git, never in chat).
// The PUBLIC key is safe to share: pin it with  node wire_attest_pin.cjs <public key>
const { schnorr, secp256k1 } = require('@noble/curves/secp256k1');
const { bytesToHex } = require('@noble/hashes/utils');
const sk = secp256k1.utils.randomPrivateKey();
console.log('\nTOWNHALL_ATTEST_SK (SECRET - Flux secret only):\n  ' + bytesToHex(sk));
console.log('\nattest public key (x-only, safe to share / pin):\n  ' + bytesToHex(schnorr.getPublicKey(sk)) + '\n');
console.log('Close this window after copying. Do not paste the secret anywhere else.\n');
