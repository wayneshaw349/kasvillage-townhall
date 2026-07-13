const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let c = fs.readFileSync(f, 'utf8');

// Use the exact canonical pattern the rest of the file uses for own-pubkey:
//   kv_public_key  ||  b2h(secpPub(wallet.privKeyHex))
const anchor = "const myPub = await SecureStore.getItemAsync('kaspa_pubkey');";
const n = c.split(anchor).length - 1;
if (n !== 1) { console.error('ABORT: anchor count = ' + n); process.exit(1); }

const replacement =
`let myPub = '';
                          try {
                            const _w = await loadMainWallet();
                            myPub = (await SecureStore.getItemAsync('kv_public_key')) || b2h(secpPub(_w.privKeyHex));
                          } catch (_e) {
                            myPub = (await SecureStore.getItemAsync('kv_public_key')) || (await SecureStore.getItemAsync('kaspa_pubkey')) || '';
                          }`;

c = c.replace(anchor, replacement);
fs.writeFileSync(f, c);
console.log('OK — Share button uses canonical kv_public_key || b2h(secpPub(privKeyHex))');
