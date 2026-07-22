const fs = require('fs');
function die(m){ console.error('[Passphrase] ABORT - ' + m + ' (nothing written)'); process.exit(1); }

let a = fs.readFileSync('bip39_wallet.ts', 'utf8');

const d1 = "  passphrase = 'kasvillage'";
if (a.split(d1).length - 1 !== 1) die("bip39 default param: expected 1, found " + (a.split(d1).length - 1));
a = a.replace(d1, "  passphrase = ''");

const c1 = "const seed = await mnemonicToSeed(mnemonic, 'kasvillage');";
if (a.split(c1).length - 1 !== 1) die("bip39 explicit call: expected 1, found " + (a.split(c1).length - 1));
a = a.replace(c1, "const seed = await mnemonicToSeed(mnemonic, '');");

const cm = '//       \u2193 mnemonicToSeed()  [PBKDF2-SHA512, passphrase = "kasvillage"]';
if (a.indexOf(cm) !== -1) { a = a.replace(cm, '//       \u2193 mnemonicToSeed()  [PBKDF2-SHA512, passphrase = "" (empty = standard BIP39, portable)]'); }
else { console.warn('[Passphrase] NOTE: header comment not matched verbatim (non-fatal).'); }

if (a.indexOf("mnemonicToSeed(mnemonic, 'kasvillage')") !== -1) die("bip39 still has a kasvillage call");
if (a.indexOf("passphrase = 'kasvillage'") !== -1) die("bip39 still has kasvillage default");
fs.writeFileSync('bip39_wallet.ts', a, 'utf8');

let b = fs.readFileSync('wallet_registration_v2.ts', 'utf8');
const c2 = "const seed = await mnemonicToSeed(mnemonic, 'kasvillage');";
if (b.split(c2).length - 1 !== 1) die("reg-v2 explicit call: expected 1, found " + (b.split(c2).length - 1));
b = b.replace(c2, "const seed = await mnemonicToSeed(mnemonic, '');");
if (b.indexOf("mnemonicToSeed(mnemonic, 'kasvillage')") !== -1) die("reg-v2 still has a kasvillage call");
fs.writeFileSync('wallet_registration_v2.ts', b, 'utf8');

console.log('[Passphrase] OK - 3 sites flipped to empty passphrase. Wallets now standard-portable BIP39; attestation re-attaches to new pubkey on next run.');