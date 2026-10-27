// check_mod_key.cjs - identify a cold key you hold (e.g. from a saved QR code). Runs fully on your
// machine, stores nothing, sends nothing. Paste the 64-hex SECRET when asked - never share it anywhere else.
//   node check_mod_key.cjs
const { secp256k1, schnorr } = require('@noble/curves/secp256k1');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
const fs = require('fs');
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste the key from your QR (64 hex) and press Enter: ', (ans) => {
  rl.close();
  const sk = String(ans || '').trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(sk)) { console.log('\nThat is not a 64-hex private key (it may be a seed phrase, an address, or a public key).'); return; }
  let comp, xonly;
  try { comp = bytesToHex(secp256k1.getPublicKey(hexToBytes(sk), true)); xonly = bytesToHex(schnorr.getPublicKey(hexToBytes(sk))); }
  catch (e) { console.log('\nNot a valid secp256k1 key: ' + e.message); return; }
  const cur = (fs.readFileSync('kaspa_payload.ts', 'utf8').match(/KV_MOD_PUBKEY = '([0-9a-f]{66})'/) || [])[1] || '';
  console.log('\n  your compressed pubkey: ' + comp);
  if (comp === cur) console.log('\n  ✅ MATCH: this IS the CURRENT moderator key (KV_MOD_PUBKEY). Rotating replaces exactly this.');
  else if (comp === '037d42aac927f9fad639cd0b479b3e921951d90361fd2e1e05d184f8122bf17133') console.log('\n  ℹ️ This is an OLD moderator key (already superseded). Safe to discard.');
  else if (xonly === '7480a21cc3f6cb6d98947202b2ae4081ea0d481d3e3619971969c224afb4fe42') console.log('\n  ℹ️ This is the RETIRED canary attest key (already powerless). Safe to discard.');
  else console.log('\n  ❌ NO MATCH with the moderator key. It may be your WALLET or VAULT key - if so, KEEP it safe and do NOT retire it; it can hold funds.');
});
