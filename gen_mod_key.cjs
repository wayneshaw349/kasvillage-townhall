// gen_mod_key.cjs - make a NEW cold moderator keypair on YOUR machine. Nothing written to disk or sent anywhere.
//   node gen_mod_key.cjs
// The SECRET is your cold mod key: keep it offline (paper / password manager). You paste it into the
// app only at the moment you sign a moderation action - it is never stored.
// The PUBLIC key (66 hex, compressed) goes into the wallet with:  node wire_mod_pubkey.cjs <public key>
const { secp256k1 } = require('@noble/curves/secp256k1');
const { bytesToHex } = require('@noble/hashes/utils');
const sk = secp256k1.utils.randomPrivateKey();
console.log('\nMODERATOR SECRET (cold - keep offline, paste only when signing):\n  ' + bytesToHex(sk));
console.log('\nmoderator public key (compressed, safe to share / commit):\n  ' + bytesToHex(secp256k1.getPublicKey(sk, true)) + '\n');
console.log('Close this window after copying. Never commit or message the secret.\n');
