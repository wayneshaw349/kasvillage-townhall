const fs = require('fs');
const f = 'NeighborAgreement.tsx';
let c = fs.readFileSync(f, 'utf8');

// Replace the Share-my-pubkey onPress body so it derives from the wallet (correct parity),
// with SecureStore fallbacks. Anchor on the unique single-line lookup we inserted.
const anchor = "const myPub = await SecureStore.getItemAsync('kaspa_pubkey');";
const n = c.split(anchor).length - 1;
if (n < 1) { console.error('ABORT: anchor not found'); process.exit(1); }
if (n > 1) { console.error('ABORT: anchor not unique (' + n + ')'); process.exit(1); }

const replacement =
`let myPub = '';
                          try { const _w = await loadMainWallet(); myPub = (_w && (_w.publicKey || _w.pubkey)) ? (_w.publicKey || _w.pubkey) : ''; } catch (_e) {}
                          if (!myPub) myPub = (await SecureStore.getItemAsync('kaspa_pubkey')) || (await SecureStore.getItemAsync('kv_public_key')) || (await SecureStore.getItemAsync('kaspa_public_key')) || '';`;

c = c.replace(anchor, replacement);
fs.writeFileSync(f, c);
console.log('OK — Share button now derives pubkey from wallet with fallbacks');
